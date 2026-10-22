# Kit de marca do Eazy

Tudo em `public/` (favicons, ícones PWA, splash do iOS, og-image) e em
`src/assets/brand/` é **gerado** a partir do logo vetorizado. Não edite os PNGs
na mão — rode o gerador.

| Arquivo | Onde aparece |
|---|---|
| `src/assets/brand/eazy-lockup(-dark).svg` | Menu lateral aberto (claro/escuro) |
| `src/assets/brand/eazy-mark.svg` | Menu recolhido, header no mobile, login |
| `src/assets/brand/eazy-wordmark(-dark).svg` | Login |
| `src/assets/brand/eazy-lockup-tagline(-dark).svg` | Livre (com o slogan) |
| `public/favicon.{svg,ico}`, `favicon-*.png` | Aba do navegador (16–48px com traço engrossado) |
| `public/pwa-*.png` | Manifest `any` — tile arredondado, cantos transparentes |
| `public/maskable-icon-*.png` | Manifest `maskable` — o Android recorta no formato do launcher |
| `public/monochrome-icon-512x512.png` | Ícones temáticos do Android 13+ |
| `public/apple-touch-icon.png` | Tela inicial do iOS (sem transparência) |
| `public/splash/apple-splash-*.png` | Splash do PWA no iOS, claro e escuro, iPhone SE → 17 Pro Max e iPads |
| `public/badge-96x96.png` | Badge de notificação push (silhueta branca) |
| `public/og-image.png` | Prévia de link (WhatsApp, LinkedIn…), 1200×630 |

## Regerar

```bash
pip install opencv-python pillow numpy resvg-py fonttools
cd scripts/brand
# 1) só se o logo-fonte mudar: vetoriza o PNG 1052x577 (gera hand.d, eazy.d)
python trace.py /caminho/logo.png
# 2) só se o slogan mudar: Roboto Condensed 800 em fonts/package/files
#    (npm pack @fontsource/roboto-condensed && tar xzf … -C fonts)
python tagline.py
# 3) gera tudo na raiz do repo
python build.py ../..
```

`build.py` também escreve `splash-links.html` com as `<link>` que vão no
`index.html` — cole lá se mudar a lista de aparelhos.
