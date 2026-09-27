"""Static TTFs of the site's fonts for the title cards and captions.

    python3 fonts.py        -> fonts/DTCinzel.ttf, fonts/DTFigtree.ttf

libass (ffmpeg's subtitle renderer) wants plain static fonts, so the site's
variable woff2 files are pinned to one weight each (Cinzel 700, Figtree 600)
and renamed "DT Cinzel" / "DT Figtree" so they can't collide with a system
copy. Needs fonttools + brotli (requirements.txt).
"""
import os

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "../../../apps/web/app/fonts")
OUT = os.path.join(HERE, "fonts")

for src, family, weight in [("cinzel-latin.woff2", "DT Cinzel", 700), ("figtree-latin.woff2", "DT Figtree", 600)]:
    font = TTFont(os.path.join(SRC, src))
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": weight})
    font.flavor = None
    name = font["name"]
    for rec in list(name.names):
        if rec.nameID in (1, 4, 16):
            name.setName(family, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 6:
            name.setName(family.replace(" ", ""), rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (2, 17):
            name.setName("Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, family.replace(" ", "") + ".ttf")
    font.save(dst)
    print(dst)
