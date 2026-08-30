import http.server, socketserver, gzip, io, os, mimetypes
# віддаємо корінь сайту, а не теку скриптів
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # кешування, як на нормальному хостингу
        p = self.path.split('?')[0]
        if any(p.endswith(e) for e in ('.css','.js','.woff2','.jpg','.webp','.png','.mp4','.webm','.ico')):
            self.send_header('Cache-Control','public, max-age=31536000, immutable')
        else:
            self.send_header('Cache-Control','public, max-age=600')
        super().end_headers()
    def do_GET(self):
        p = self.translate_path(self.path)
        if os.path.isdir(p): p = os.path.join(p,'index.html')
        if not os.path.isfile(p): return super().do_GET()
        ctype = mimetypes.guess_type(p)[0] or 'application/octet-stream'
        data = open(p,'rb').read()
        gz = 'gzip' in self.headers.get('Accept-Encoding','') and any(
            p.endswith(e) for e in ('.html','.css','.js','.json','.svg','.xml','.txt','.webmanifest'))
        if gz: data = gzip.compress(data, 6)
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        if gz: self.send_header('Content-Encoding','gzip')
        self.end_headers()
        self.wfile.write(data)
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(('',8901), H).serve_forever()
