// ─────────────────────────────────────────────────────────────
//  aimbotTestDefs.ts
//  Drop this in:  shared/defs/maps/aimbotTestDefs.ts
//  Then register it in mapDefs.ts (see comment at bottom)
// ─────────────────────────────────────────────────────────────
import { util } from "../../utils/util.ts";
import type { MapDef } from "../mapDefs.ts";
import { Main, type PartialMapDef } from "./baseDefs.ts";

export const aimbotTest = util.mergeDeep(
    {},
    Main,
    {
        mapGen: {
            map: {
                // Small flat arena — big enough to strafe around
                baseWidth:  64,
                baseHeight: 64,
                // No rivers, no lakes
                rivers: {
                    lakes:       [],
                    weights:     [{ weight: 1, widths: [] }],
                    spawnCabins: false,
                },
            },
            // Kill all random/fixed/density spawns so the map is empty
            customSpawnRules: {
                locationSpawns: [],
                placeSpawns:    [],
            },
            densitySpawns: [{}],
            fixedSpawns: [{
                tree_07: 12,
            }],
            randomSpawns: [],
            spawnReplacements:[{}],
        },
    } satisfies PartialMapDef,
) as MapDef;

/*
 ADD TO shared/defs/mapDefs.ts:

   import { aimbotTest } from "./maps/aimbotTestDefs.ts";   // ← new import

   export const MapDefs = {
     ...
     /* STRIP_FROM_PROD_CLIENT:START *\/
     test_normal:   testNormal,
     test_faction:  testFaction,
     aimbot_test:   aimbotTest,                              // ← add this line
     /* STRIP_FROM_PROD_CLIENT:END *\/
   };
*/