// Versioned benchmark snapshot. Logged activities earn app achievements, not official records.
export const PERFORMANCE_PRESTIGE_TIERS = ["pro", "champion", "elite", "unreal"];
export const PERFORMANCE_STAR_LIMIT = 10;
const date = "2026-10-08";
const pace = {
  run_5k: { targets: [1110,1080,1050,1020], ceiling:769, label:"Men’s road 5 km world-record reference", source:"https://worldathletics.org/records/all-time-toplists/road-running/5-kilometres/outdoor/men/senior" },
  run_10k: { targets:[2520,2400,2280,2160], ceiling:1591, label:"Men’s road 10 km world-record reference", source:"https://worldathletics.org/records/all-time-toplists/road-running/10-kilometres/all/men/senior" },
  run_half: { targets:[5400,5100,4800,4500], ceiling:3411, label:"Men’s half marathon reported record reference (pending ratification)", source:"https://worldathletics.org/news/report/world-half-marathon-record-buenos-aires-2026-yomif-kejelcha" },
  bike_20k: {targets:[1860,1740,1620,1500],ceiling:1080},
  bike_40k: {targets:[3900,3600,3300,3000],ceiling:2160},
  bike_100k: {targets:[8400,7800,7200,6600],ceiling:5400},
  walk_5k: {targets:[1980,1860,1740,1620],ceiling:1200},
  walk_10k: {targets:[4500,4200,3900,3600],ceiling:2520},
  walk_half: {targets:[9900,9000,8100,7200],ceiling:5400},
  row_2k: {targets:[375,370,365,360],ceiling:335},
  row_5k: {targets:[1020,990,960,930],ceiling:840},
  row_10k: {targets:[2280,2220,2160,2100],ceiling:1800},
  swim_750m: {targets:[660,630,600,570],ceiling:420},
  swim_1500m: {targets:[1380,1320,1260,1200],ceiling:866.79,label:"Men’s 1500 m freestyle long-course world-record reference", source:"https://www.worldaquatics.com/news/4564249/paris-2026-marchand-magic-superwoman-sara-and-popovici-performs"},
  swim_3k: {targets:[2760,2640,2520,2400],ceiling:1800},
};
const cumulative = {
  badge_volume_kg:{targets:[350000,600000,1000000,2000000],step:1000000},
  badge_total_sets:{targets:[7500,10000,15000,25000],step:5000},
  badge_total_reps:{targets:[75000,100000,150000,250000],step:50000},
  badge_early:{targets:[150,250,400,600],step:100},
  badge_night:{targets:[150,250,400,600],step:100},
  badge_overload:{targets:[90,150,240,400],step:100},
  badge_session_sets:{targets:[20,50,100,200],step:50,statKey:"stats.sessions.strengthTrainingDays",unit:"strength days with 10+ sets", note:"After Diamond, build consistency: each recorded day with at least 10 strength sets counts once. Extra sets that day do not advance prestige."},
  badge_pace_imp:{targets:[6,12,24,40],step:10,statKey:"stats.intelligence.paceImprovementDays",unit:"qualifying improvement days",note:"After Diamond, count distinct activity dates showing at least 3% pace improvement in a 28-day window against the preceding 28 days. Each date counts once across all distances and sports."},
};
export function extendPerformanceTiers(idPrefix, original) {
  if (idPrefix.startsWith("badge_sport_")) return {tiers:original,starTiers:[],prestige:null};
  const match = idPrefix.match(/^badge_(.+)_pace$/);
  let settings = match ? pace[match[1]] : cumulative[idPrefix];
  if (idPrefix.endsWith("_count")) settings={targets:[40,60,90,120],step:40};
  if (idPrefix.startsWith("badge_streak_")) settings={targets:[5,6,7,8].map(i=>original[0].threshold+60*i),step:60};
  if (!settings) throw new Error(`Missing prestige progression: ${idPrefix}`);
  const extras=PERFORMANCE_PRESTIGE_TIERS.map((tier,index)=>({tier,threshold:settings.targets[index],xp:idPrefix.startsWith("badge_streak_")?original[4].xp:[110,130,160,200][index],...(settings.statKey?{statKey:settings.statKey,unit:settings.unit}: {})}));
  const unreal=extras[3].threshold;
  const starTiers=Array.from({length:PERFORMANCE_STAR_LIMIT},(_,index)=>{
    const star=index+1;
    const threshold=match ? Math.round((settings.ceiling+(unreal-settings.ceiling)*Math.pow(1-star/PERFORMANCE_STAR_LIMIT,1.5))*100)/100 : unreal+settings.step*star;
    return {key:`${idPrefix}_unreal_star_${star}`,tier:"unreal",star,threshold,xp:0,...(settings.statKey?{statKey:settings.statKey,unit:settings.unit}: {})};
  });
  return {tiers:[...original,...extras],starTiers,prestige:{...settings,benchmarkDate:date,benchmarkLabel:settings.label|| (match?"Workout Tracker aspirational target (not an official record)":null)}};
}
