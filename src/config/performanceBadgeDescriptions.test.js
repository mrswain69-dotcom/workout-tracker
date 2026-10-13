import { expect, it } from 'vitest';
import { BADGE_CARDS } from './badges.js';
import { performanceBadgeDescription } from './performanceBadgeDescriptions.js';
it('explains purpose, measurement, eligible activities and method for every Performance card',()=>{
 for(const card of BADGE_CARDS.filter(c=>c.badgeGroup!=='sport_mastery')){
  const detail=performanceBadgeDescription(card);
  for(const key of ['purpose','measurement','activities','method','rewards']) expect(detail[key],`${card.id}: ${key}`).toBeTruthy();
 }
});
it('keeps sport mastery on its own explanation path',()=>{
 expect(performanceBadgeDescription(BADGE_CARDS.find(c=>c.badgeGroup==='sport_mastery'))).toBeNull();
});
