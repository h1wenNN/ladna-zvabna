# -*- coding: utf-8 -*-
"""Кольорокорекція кадрів під палітру салону.

Джерело - кадри з відео: холодні, синювато-сірі, м'які. Кожен сам по собі
непоганий, але разом вони не читаються як одна зйомка. Тут вони зводяться
до однієї плівки: тепле світло (молочний #F7F5F0), мідні тіні, приглушена
зелень і трохи різкості.

Нічого не домальовується - лише те, що зробив би колорист.
ЗАПУСК (один раз, з оригіналів у _dev/img-src/):
    python3 _dev/tools/grade.py
"""
import sys, os, glob
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

MILK   = np.array([247, 245, 240], dtype=np.float32)
COPPER = np.array([182, 112,  92], dtype=np.float32)

def curve(x, lift, gain, gamma):
    y = np.clip(x / 255.0, 0, 1) ** gamma
    return np.clip((lift / 255.0 + y * gain) * 255.0, 0, 255)

def grade(im):
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    # 1. Баланс білого: прибираємо синій кастинг ламп
    a[..., 0] *= 1.045; a[..., 1] *= 1.005; a[..., 2] *= 0.930
    # 2. Плівкова крива: підняті тіні, притиснуті світла
    a[..., 0] = curve(a[..., 0], 7, 0.955, 0.98)
    a[..., 1] = curve(a[..., 1], 6, 0.950, 0.99)
    a[..., 2] = curve(a[..., 2], 5, 0.940, 1.02)
    # 3. Спліт-тонування: світла в молоко, тіні в мідь
    lum = (a[..., 0]*0.299 + a[..., 1]*0.587 + a[..., 2]*0.114) / 255.0
    hi  = np.clip((lum - 0.55) / 0.45, 0, 1)[..., None]
    lo  = np.clip((0.45 - lum) / 0.45, 0, 1)[..., None]
    a = a * (1 - hi*0.10) + MILK   * (hi*0.10)
    a = a * (1 - lo*0.13) + COPPER * (lo*0.13)
    out = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    # 4. Зелень трохи назад, щоб рослини не били по мідній гамі
    out = ImageEnhance.Color(out).enhance(0.90)
    # 5. Контраст у середніх тонах
    out = ImageEnhance.Contrast(out).enhance(1.07)
    # 6. Різкість: кадри з відео м'які
    out = out.filter(ImageFilter.UnsharpMask(radius=1.4, percent=75, threshold=3))
    # Зерна у файли НЕ додаємо: на сторінці вже є шар .grain, а шум у JPEG
    # коштував би +40% ваги (герой 75 -> 107 КБ) і бив би по LCP.
    return out

if __name__ == '__main__':
    R = os.path.join(os.path.dirname(__file__), '..', '..')
    SRC = os.path.join(R, '_dev', 'img-src')
    tot_b = tot_a = 0
    files = sorted(glob.glob(os.path.join(R, 'assets/img/details/*.jpg'))) + [
        os.path.join(R, 'assets/img/interior/cosy.jpg'),
        os.path.join(R, 'assets/img/interior/hero.jpg')]
    for f in files:
        src = os.path.join(SRC, os.path.basename(f))
        if not os.path.exists(src):          # перший запуск: ховаємо оригінал
            os.makedirs(SRC, exist_ok=True)
            Image.open(f).save(src, quality=95, subsampling=0)
        w = f[:-4] + '.webp'
        tot_b += os.path.getsize(f) + (os.path.getsize(w) if os.path.exists(w) else 0)
        g = grade(Image.open(src))
        g.save(f, quality=86, subsampling=1, optimize=True)
        # герой - LCP-елемент: він єдиний, кому варта важливіша за різкість
        q = 64 if 'hero' in f else (68 if 'cosy' in f else 72)
        if os.path.exists(w): g.save(w, quality=q, method=6)
        tot_a += os.path.getsize(f) + (os.path.getsize(w) if os.path.exists(w) else 0)
        print('%-28s %7d -> %7d' % (os.path.basename(f), 0, os.path.getsize(f)))
    h = Image.open(os.path.join(R, 'assets/img/interior/hero.jpg'))
    s = h.resize((520, round(520 * h.size[1] / h.size[0])), Image.LANCZOS)
    s.save(os.path.join(R, 'assets/img/interior/hero-520.webp'), quality=64, method=6)
    print('РАЗОМ %d -> %d байтів' % (tot_b, tot_a))
