#!/usr/bin/env python3
"""Saytni bitta HTML faylga yig'adi (demo rejim, Supabase kutubxonasisiz).
Foydalanish: python3 tools/build_preview.py [chiqish_fayli]
Natija Claude Artifact kabi yagona fayl sifatida joylash uchun mos."""
import base64, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "preview.html")
rd = lambda p: open(os.path.join(root, p), encoding="utf-8").read()

html = rd("index.html")
body = re.search(r"<body>(.*?)<script", html, re.S).group(1)
logo = "data:image/jpeg;base64," + base64.b64encode(open(os.path.join(root, "assets/logo.jpg"), "rb").read()).decode()
body = body.replace("assets/logo.jpg", logo)
css = rd("styles.css")
js = "\n".join(rd(f) for f in ["config.js", "i18n.js", "art.js", "defaults.js", "api.js", "app.js"])
head = re.search(r"<title>.*?</title>", html, re.S).group(0)
fonts = re.search(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>', html).group(0)
page = ('%s\n<meta name="claude:viewport-fit-sides" content="cover">\n%s\n<style>\n%s\n</style>\n%s\n<script>\n%s\n</script>\n'
        % (head, fonts, css, body, js))
open(out, "w", encoding="utf-8").write(page)
print("yozildi:", out, len(page) // 1024, "KB")
