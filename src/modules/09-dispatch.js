/* ===== 09. DISPATCH MAP =====
   Synthetic movement feed standing in for a real GPS/telematics provider.
   Seam: replace DISP.feed()/DISP.tick() with the provider's live stream —
   everything else on the dispatch screen (map, list, filters) is untouched. */
(function(global){
'use strict';
const U = global.GC.Utils;
const { rng, randInt } = U;

// Rough bounding boxes for demo purposes only (not real basemap tiles).
const CITY_BOX = {
  'Касабланка': { lat:[33.53,33.60], lng:[-7.65,-7.55] },
  'Рабат':      { lat:[34.00,34.04], lng:[-6.86,-6.79] }
};

function buildDispatch(DB, R){
  const wd = global.GC.workingDrivers(DB);
  DB._dispatch = wd.map(d => {
    const div = DB.divs.find(x=>x.id===d.div);
    const box = CITY_BOX[div.city] || CITY_BOX['Касабланка'];
    const lat = box.lat[0] + R()*(box.lat[1]-box.lat[0]);
    const lng = box.lng[0] + R()*(box.lng[1]-box.lng[0]);
    return {
      driverId: d.id, driver: d.fio, car: DB.cars.find(c=>c.id===d.car).plate,
      city: div.city, lat, lng, heading: Math.floor(R()*360),
      status: R()<0.7 ? 'На линии' : 'Свободен', speed: randInt(R,0,80)
    };
  });
}

// Advances every vehicle a small random step — call on an interval from the
// UI layer if a live-feel map is wanted. Pure function of current state, no
// external randomness source stored, so it's safe to call repeatedly.
function tickDispatch(DB){
  (DB._dispatch||[]).forEach(p => {
    const rad = p.heading * Math.PI/180;
    p.lat += Math.cos(rad)*0.0006;
    p.lng += Math.sin(rad)*0.0006;
    p.heading = (p.heading + (Math.random()*20-10) + 360) % 360;
    p.speed = Math.max(0, Math.min(90, p.speed + Math.round(Math.random()*10-5)));
  });
  return DB._dispatch;
}

global.GC.buildDispatch = buildDispatch;
global.GC.tickDispatch = tickDispatch;

})(typeof window !== 'undefined' ? window : globalThis);
