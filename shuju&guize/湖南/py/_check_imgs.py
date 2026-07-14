from pathlib import Path
root = Path(r'C:\Users\32614\Desktop\sport_tool\dm\shuju&guize\湖南')
for p in root.rglob('_rendered_pages'):
    imgs = list(p.rglob('*.png'))
    print(f'{p}: {len(imgs)} images')
for p in root.rglob('*preview*'):
    if p.is_dir():
        imgs = list(p.rglob('*.png'))
        print(f'{p}: {len(imgs)} images')
