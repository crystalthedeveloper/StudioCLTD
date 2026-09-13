"""Generate mobile WebP variants using cwebp; preserve GLB meshes/rigs/Meshopt data."""
import json, pathlib, struct, subprocess, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
mapping = {}
def encode(source, target, limit):
    # cwebp preserves aspect ratio when one resize dimension is zero.
    info = subprocess.check_output(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', str(source)], text=True)
    dims = [int(line.split(':')[1]) for line in info.splitlines() if 'pixelWidth:' in line or 'pixelHeight:' in line]
    w, h = dims
    resize = ['-resize', str(limit if w >= h else 0), str(limit if h > w else 0)] if max(w,h) > limit else []
    subprocess.run(['cwebp', '-quiet', '-q', '82', *resize, str(source), '-o', str(target)], check=True)
for source in sorted((PUBLIC / 'images/optimized').rglob('*')):
    if source.suffix.lower() not in ('.webp', '.jpg', '.png'): continue
    relative = source.relative_to(PUBLIC / 'images/optimized').with_suffix('.webp')
    target = PUBLIC / 'images/mobile' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    encode(source, target, 512 if relative.parts[0] == 'floor' else 1024)
    mapping['/' + str(source.relative_to(PUBLIC))] = '/' + str(target.relative_to(PUBLIC))
for source in sorted(PUBLIC.rglob('*-optimized.glb')):
    data = source.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20+size])
    binary = data[28+size:]
    replacements = []
    with tempfile.TemporaryDirectory() as temp:
        for index, img in enumerate(doc.get('images', [])):
            view = doc['bufferViews'][img['bufferView']]
            assert view.get('buffer', 0) == 0
            start, length = view.get('byteOffset', 0), view['byteLength']
            src = pathlib.Path(temp) / f'{index}.{img["mimeType"].split("/")[1]}'
            dst = pathlib.Path(temp) / f'{index}-mobile.webp'
            src.write_bytes(binary[start:start+length]); encode(src, dst, 512)
            encoded = dst.read_bytes()
            replacements.append((start, (start+length+3)//4*4, encoded))
            view['byteLength'] = len(encoded); img['mimeType'] = 'image/webp'
    replacements.sort()
    def shifted(offset):
        return offset + sum((len(b)+3)//4*4-(end-start) for start,end,b in replacements if end <= offset)
    chunks, cursor = [], 0
    for start,end,b in replacements:
        assert start >= cursor
        chunks.extend([binary[cursor:start], b, b'\0' * (-len(b)%4)]); cursor=end
    chunks.append(binary[cursor:]); new_binary=b''.join(chunks)
    for view in doc['bufferViews']:
        if view.get('buffer',0) == 0: view['byteOffset'] = shifted(view.get('byteOffset',0))
        ext = view.get('extensions',{}).get('EXT_meshopt_compression')
        if ext and ext.get('buffer',0) == 0: ext['byteOffset'] = shifted(ext.get('byteOffset',0))
    for texture in doc.get('textures',[]):
        if 'source' in texture:
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
    for key in ['extensionsUsed', 'extensionsRequired']:
        if 'EXT_texture_webp' not in doc.setdefault(key,[]): doc[key].append('EXT_texture_webp')
    doc['buffers'][0]['byteLength'] = len(new_binary)
    header = json.dumps(doc,separators=(',',':')).encode(); header += b' ' * (-len(header)%4)
    output = struct.pack('<III',0x46546c67,2,28+len(header)+len(new_binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(new_binary),0x004e4942)+new_binary
    target = source.with_name(source.name.replace('-optimized','-mobile')); target.write_bytes(output)
    mapping['/'+str(source.relative_to(PUBLIC))] = '/'+str(target.relative_to(PUBLIC))
(ROOT / 'src/world/mobile-assets.json').write_text(json.dumps(mapping,indent=2)+'\n')
print(f'Generated {len(mapping)} mobile assets')
