import { expect, it } from 'vitest';
import { nativeArtworkSrc } from './artwork.js';
import { nativeAuthRedirect } from './platform.js';
it('maps only exact packaged artwork and leaves stored identities and remote URLs alone',()=>{
 const map={'/avatars/sport/football_gold_female_v3.png':'/avatars/sport/football_gold_female_v3.webp'};
 const original='/avatars/sport/football_gold_female_v3.png';
 expect(nativeArtworkSrc(original,map)).toBe(map[original]);
 for(const src of [null,undefined,'https://example.com/avatars/a.png','/avatars/not-packaged.png','/badges/bg/bg_x.svg','/avatars/sport/football_gold_female_v3.png?x=1']) expect(nativeArtworkSrc(src,map)).toBe(src);
 expect(original).toBe('/avatars/sport/football_gold_female_v3.png');
 expect(nativeArtworkSrc(original)).toBe(original);
});
it('keeps staging callbacks separate from the release app',()=>{
 expect(nativeAuthRedirect('staging')).toBe('io.workouttrackerapp.app.staging://auth/callback');
 expect(nativeAuthRedirect('production')).toBe('io.workouttrackerapp.app://auth/callback');
});
