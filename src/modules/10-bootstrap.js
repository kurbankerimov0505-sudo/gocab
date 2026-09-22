/* ===== 10. BOOTSTRAP — assembles the whole in-memory DB in dependency order ===== */
(function(global){
'use strict';
const G = global.GC;
const { rng } = G.Utils;

const SEED = 20260908;

function buildDB(){
  const R = rng(SEED);
  const DB = G.buildRefData();
  G.buildUsers(DB);
  G.buildFleet(DB, R);
  G.buildDrivers(DB, R);

  G.buildCashLedgerBase(DB, R);

  G.buildFines(DB, R);
  G.buildInstalments(DB, R);
  G.buildCompensations(DB, R);
  G.buildOrders(DB, R);
  G.buildParts(DB, R);
  G.buildService(DB, R);
  G.buildDeposits(DB, R);
  G.buildPayouts(DB, R);
  G.buildContracts(DB, R);
  G.buildIncidents(DB, R);
  G.buildLeases(DB, R);
  G.buildTickets(DB, R);
  G.buildMailings(DB, R);
  G.buildPnl(DB, R);
  G.buildHistory(DB, R);
  G.buildImportsAndComments(DB);
  G.buildDupes(DB, R);

  G.buildRepairOrders(DB, R);
  G.buildActs(DB, R);
  G.buildShifts(DB, R);
  G.buildInspections(DB, R);
  G.buildDispatch(DB, R);

  G.runCollectionModel(DB, R);
  G.applyCollectionToLedger(DB);
  DB._kpi = G.computeManagerKPI(DB);

  return DB;
}

global.GC.buildDB = buildDB;
global.GC.SEED = SEED;

})(typeof window !== 'undefined' ? window : globalThis);
