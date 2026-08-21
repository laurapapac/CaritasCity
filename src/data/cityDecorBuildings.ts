/**
 * Decoration-only buildings — reuse the same 9 real building models
 * (see buildingGenerators.ts) but are NEVER linked to the backend/QR system
 * at all: rendered permanently fully-built (completedBlocks === totalBlocks),
 * exactly like the church/fountain landmarks in staticCityData.ts already
 * are, just generated in bulk here instead of 2 hand-picked coordinates.
 *
 * Added 2026-08-19 so the city doesn't start completely empty of buildings —
 * user request: give it some already-built scenery from the start, without
 * fully populating it (still needs to read as "a city under construction").
 * Placed by a second, lenient pass (see generateCityLayout.ts's "Decoration
 * buildings" section) over whatever block/shelf capacity is left over after
 * the real buildings in cityLayout.ts are placed — count isn't guaranteed
 * exact (a job that doesn't fit is skipped, not fatal), unlike CITY_LAYOUT's
 * real buildings. buildingId is prefixed `deco_` so it can never collide
 * with a real buildingId, a DB-issued id, or "church"/"fountain".
 *
 * Consumed by src/components/city/staticCityData.ts, which builds each entry
 * into a CityBuilding the same way STATIC_LANDMARKS' buildLandmark() does.
 */

import type { CityLayoutEntry } from "./cityLayout";

export const DECOR_BUILDINGS: CityLayoutEntry[] = [
  {
    "buildingId": "deco_school_0",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -84,
    "z": -324
  },
  {
    "buildingId": "deco_school_1",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 86,
    "z": 389
  },
  {
    "buildingId": "deco_school_2",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -346,
    "z": 61
  },
  {
    "buildingId": "deco_school_3",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 247,
    "z": -90
  },
  {
    "buildingId": "deco_school_4",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 16,
    "z": 72
  },
  {
    "buildingId": "deco_school_5",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -313,
    "z": -192
  },
  {
    "buildingId": "deco_school_6",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -264,
    "z": 288
  },
  {
    "buildingId": "deco_school_7",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 127,
    "z": -327
  },
  {
    "buildingId": "deco_school_8",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 226,
    "z": 84
  },
  {
    "buildingId": "deco_school_9",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -8,
    "z": -126
  },
  {
    "buildingId": "deco_food_bank_0",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -116,
    "z": -90
  },
  {
    "buildingId": "deco_food_bank_1",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 368,
    "z": 64
  },
  {
    "buildingId": "deco_food_bank_2",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -13,
    "z": 371
  },
  {
    "buildingId": "deco_food_bank_3",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 191,
    "z": -277
  },
  {
    "buildingId": "deco_food_bank_4",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -326,
    "z": 177
  },
  {
    "buildingId": "deco_food_bank_5",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -181,
    "z": -319
  },
  {
    "buildingId": "deco_food_bank_6",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 102,
    "z": 105
  },
  {
    "buildingId": "deco_food_bank_7",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 134,
    "z": -80
  },
  {
    "buildingId": "deco_hospital_medium_0",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -299,
    "z": -88
  },
  {
    "buildingId": "deco_hospital_medium_1",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 354,
    "z": -30
  },
  {
    "buildingId": "deco_hospital_medium_2",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 26,
    "z": 375
  },
  {
    "buildingId": "deco_hospital_medium_3",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 79,
    "z": -386
  },
  {
    "buildingId": "deco_hospital_medium_4",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 46,
    "z": -30
  },
  {
    "buildingId": "deco_hospital_medium_5",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -220,
    "z": 292
  },
  {
    "buildingId": "deco_hospital_medium_6",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -136,
    "z": -291
  },
  {
    "buildingId": "deco_hospital_medium_7",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 289,
    "z": -254
  },
  {
    "buildingId": "deco_hospital_medium_8",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -56,
    "z": 128
  },
  {
    "buildingId": "deco_hospital_medium_9",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 230,
    "z": 262
  },
  {
    "buildingId": "deco_hospital_medium_10",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 168,
    "z": 86
  },
  {
    "buildingId": "deco_hospital_medium_11",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -127,
    "z": -66
  },
  {
    "buildingId": "deco_hospital_large_0",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -207,
    "z": -88
  },
  {
    "buildingId": "deco_hospital_large_1",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 381,
    "z": -31
  },
  {
    "buildingId": "deco_hospital_large_2",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -64,
    "z": 336
  },
  {
    "buildingId": "deco_hospital_large_3",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 54,
    "z": -359
  },
  {
    "buildingId": "deco_hospital_large_4",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 90,
    "z": 55
  },
  {
    "buildingId": "deco_hospital_large_5",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -255,
    "z": 173
  },
  {
    "buildingId": "deco_restaurant_0",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 89,
    "z": -56
  },
  {
    "buildingId": "deco_restaurant_1",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -384,
    "z": -71
  },
  {
    "buildingId": "deco_restaurant_2",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -85,
    "z": 360
  },
  {
    "buildingId": "deco_restaurant_3",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -140,
    "z": -319
  },
  {
    "buildingId": "deco_restaurant_4",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 314,
    "z": -196
  },
  {
    "buildingId": "deco_restaurant_5",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 148,
    "z": 286
  },
  {
    "buildingId": "deco_restaurant_6",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -138,
    "z": -12
  },
  {
    "buildingId": "deco_restaurant_7",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 307,
    "z": 65
  },
  {
    "buildingId": "deco_restaurant_8",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 57,
    "z": -335
  },
  {
    "buildingId": "deco_restaurant_9",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 2,
    "z": -190
  },
  {
    "buildingId": "deco_restaurant_10",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -76,
    "z": 195
  },
  {
    "buildingId": "deco_restaurant_11",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -276,
    "z": 136
  },
  {
    "buildingId": "deco_hospital_small_0",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -335,
    "z": -73
  },
  {
    "buildingId": "deco_short_apartment_0",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -298,
    "z": -64
  },
  {
    "buildingId": "deco_hospital_small_1",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 355,
    "z": -6
  },
  {
    "buildingId": "deco_short_apartment_1",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 355,
    "z": 14
  },
  {
    "buildingId": "deco_hospital_small_2",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -54,
    "z": 359
  },
  {
    "buildingId": "deco_short_apartment_2",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -86,
    "z": 380
  },
  {
    "buildingId": "deco_hospital_small_3",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 1,
    "z": -352
  },
  {
    "buildingId": "deco_short_apartment_3",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -23,
    "z": -330
  },
  {
    "buildingId": "deco_hospital_small_4",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 7,
    "z": -16
  },
  {
    "buildingId": "deco_short_apartment_4",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 68,
    "z": 78
  },
  {
    "buildingId": "deco_hospital_small_5",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 179,
    "z": 286
  },
  {
    "buildingId": "deco_short_apartment_5",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 209,
    "z": 286
  },
  {
    "buildingId": "deco_hospital_small_6",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -163,
    "z": 152
  },
  {
    "buildingId": "deco_short_apartment_6",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -163,
    "z": 172
  },
  {
    "buildingId": "deco_hospital_small_7",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 231,
    "z": -277
  },
  {
    "buildingId": "deco_short_apartment_7",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -81,
    "z": -139
  },
  {
    "buildingId": "deco_hospital_small_8",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 145,
    "z": 110
  },
  {
    "buildingId": "deco_short_apartment_8",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 181,
    "z": -257
  },
  {
    "buildingId": "deco_hospital_small_9",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -191,
    "z": -267
  },
  {
    "buildingId": "deco_short_apartment_9",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 181,
    "z": -110
  },
  {
    "buildingId": "deco_short_apartment_10",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -161,
    "z": -267
  },
  {
    "buildingId": "deco_short_apartment_11",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 271,
    "z": 84
  },
  {
    "buildingId": "deco_short_apartment_12",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 1,
    "z": 217
  },
  {
    "buildingId": "deco_short_apartment_13",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 313,
    "z": -175
  },
  {
    "buildingId": "deco_short_apartment_14",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -163,
    "z": 9
  },
  {
    "buildingId": "deco_short_apartment_15",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 52,
    "z": -189
  },
  {
    "buildingId": "deco_short_apartment_16",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -301,
    "z": 61
  },
  {
    "buildingId": "deco_short_apartment_17",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 88,
    "z": -35
  },
  {
    "buildingId": "deco_short_apartment_18",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 253,
    "z": -56
  },
  {
    "buildingId": "deco_short_apartment_19",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -239,
    "z": 58
  },
  {
    "buildingId": "deco_house_0",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -64
  },
  {
    "buildingId": "deco_house_1",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": 123
  },
  {
    "buildingId": "deco_house_2",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": 381
  },
  {
    "buildingId": "deco_house_3",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 118,
    "z": -257
  },
  {
    "buildingId": "deco_house_4",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": -5
  },
  {
    "buildingId": "deco_house_5",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 310,
    "z": -118
  },
  {
    "buildingId": "deco_house_6",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -136,
    "z": 173
  },
  {
    "buildingId": "deco_house_7",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -83,
    "z": -274
  },
  {
    "buildingId": "deco_house_8",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 119,
    "z": 238
  },
  {
    "buildingId": "deco_house_9",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -388,
    "z": 84
  },
  {
    "buildingId": "deco_house_10",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -343,
    "z": -120
  },
  {
    "buildingId": "deco_house_11",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -105
  },
  {
    "buildingId": "deco_house_12",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -65,
    "z": -12
  },
  {
    "buildingId": "deco_house_13",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 129,
    "z": -151
  },
  {
    "buildingId": "deco_house_14",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": -33
  },
  {
    "buildingId": "deco_house_15",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 172,
    "z": 111
  },
  {
    "buildingId": "deco_house_16",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -212,
    "z": 59
  },
  {
    "buildingId": "deco_house_17",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -138
  },
  {
    "buildingId": "deco_house_18",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 217
  },
  {
    "buildingId": "deco_house_19",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": 260
  },
  {
    "buildingId": "deco_house_20",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 283,
    "z": -217
  },
  {
    "buildingId": "deco_house_21",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": -248
  },
  {
    "buildingId": "deco_house_22",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -301,
    "z": -43
  },
  {
    "buildingId": "deco_house_23",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -134,
    "z": -266
  },
  {
    "buildingId": "deco_house_24",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -388,
    "z": -49
  },
  {
    "buildingId": "deco_house_25",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 196,
    "z": -35
  },
  {
    "buildingId": "deco_house_26",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 128
  },
  {
    "buildingId": "deco_house_27",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -101,
    "z": -69
  },
  {
    "buildingId": "deco_house_28",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 178,
    "z": -89
  },
  {
    "buildingId": "deco_house_29",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -112,
    "z": 153
  },
  {
    "buildingId": "deco_house_30",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 208,
    "z": 105
  },
  {
    "buildingId": "deco_house_31",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -136,
    "z": 10
  },
  {
    "buildingId": "deco_house_32",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -364,
    "z": -12
  },
  {
    "buildingId": "deco_house_33",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -65,
    "z": 42
  },
  {
    "buildingId": "deco_house_34",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -83,
    "z": -207
  },
  {
    "buildingId": "deco_house_35",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 28,
    "z": 218
  },
  {
    "buildingId": "deco_house_36",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 327,
    "z": -13
  },
  {
    "buildingId": "deco_house_37",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -266,
    "z": 10
  },
  {
    "buildingId": "deco_house_38",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 77,
    "z": -305
  },
  {
    "buildingId": "deco_house_39",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": -147
  },
  {
    "buildingId": "deco_house_40",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -291,
    "z": -12
  },
  {
    "buildingId": "deco_house_41",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 288
  },
  {
    "buildingId": "deco_house_42",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 115,
    "z": -34
  },
  {
    "buildingId": "deco_house_43",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 121,
    "z": -190
  },
  {
    "buildingId": "deco_house_44",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 340,
    "z": -174
  },
  {
    "buildingId": "deco_house_45",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 95,
    "z": 79
  },
  {
    "buildingId": "deco_house_46",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 92,
    "z": 260
  },
  {
    "buildingId": "deco_house_47",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -52,
    "z": -89
  },
  {
    "buildingId": "deco_house_48",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -54,
    "z": -138
  },
  {
    "buildingId": "deco_house_49",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 182
  },
  {
    "buildingId": "deco_tall_apartment_0",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -164,
    "z": -69
  },
  {
    "buildingId": "deco_tall_apartment_1",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 311,
    "z": -97
  },
  {
    "buildingId": "deco_tall_apartment_2",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 117,
    "z": 259
  },
  {
    "buildingId": "deco_tall_apartment_3",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 5,
    "z": -330
  },
  {
    "buildingId": "deco_tall_apartment_4",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 93,
    "z": -6
  },
  {
    "buildingId": "deco_tall_apartment_5",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -387,
    "z": 9
  },
  {
    "buildingId": "deco_tall_apartment_6",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -87,
    "z": 152
  },
  {
    "buildingId": "deco_tall_apartment_7",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 146,
    "z": -191
  },
  {
    "buildingId": "deco_tall_apartment_8",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 233,
    "z": 104
  },
  {
    "buildingId": "deco_tall_apartment_9",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -67,
    "z": 287
  },
  {
    "buildingId": "deco_fill_house_0",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": -274
  },
  {
    "buildingId": "deco_fill_house_1",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -107,
    "z": -252
  },
  {
    "buildingId": "deco_fill_house_2",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -83,
    "z": -252
  },
  {
    "buildingId": "deco_fill_house_3",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": -252
  },
  {
    "buildingId": "deco_fill_house_4",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": -207
  },
  {
    "buildingId": "deco_fill_house_5",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -107,
    "z": -185
  },
  {
    "buildingId": "deco_fill_house_6",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -83,
    "z": -185
  },
  {
    "buildingId": "deco_fill_house_7",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": -185
  },
  {
    "buildingId": "deco_fill_house_8",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -364,
    "z": -49
  },
  {
    "buildingId": "deco_fill_house_9",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -338,
    "z": -52
  },
  {
    "buildingId": "deco_fill_house_10",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -235,
    "z": -70
  },
  {
    "buildingId": "deco_fill_house_11",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -259,
    "z": -48
  },
  {
    "buildingId": "deco_fill_house_12",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -235,
    "z": -48
  },
  {
    "buildingId": "deco_fill_house_13",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -42
  },
  {
    "buildingId": "deco_fill_house_14",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -165,
    "z": -48
  },
  {
    "buildingId": "deco_fill_house_15",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -116
  },
  {
    "buildingId": "deco_fill_house_16",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -84,
    "z": -116
  },
  {
    "buildingId": "deco_fill_house_17",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -60,
    "z": -116
  },
  {
    "buildingId": "deco_fill_house_18",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -41
  },
  {
    "buildingId": "deco_fill_house_19",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -105,
    "z": -41
  },
  {
    "buildingId": "deco_fill_house_20",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -76,
    "z": -67
  },
  {
    "buildingId": "deco_fill_house_21",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -52,
    "z": -67
  },
  {
    "buildingId": "deco_fill_house_22",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -76,
    "z": -45
  },
  {
    "buildingId": "deco_fill_house_23",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -52,
    "z": -45
  },
  {
    "buildingId": "deco_fill_house_24",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -362,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_25",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -315,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_26",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -291,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_27",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -364,
    "z": 84
  },
  {
    "buildingId": "deco_fill_house_28",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -340,
    "z": 84
  },
  {
    "buildingId": "deco_fill_house_29",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -316,
    "z": 84
  },
  {
    "buildingId": "deco_fill_house_30",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -292,
    "z": 84
  },
  {
    "buildingId": "deco_fill_house_31",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -242,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_32",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -218,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_33",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -194,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_34",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -266,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_35",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -242,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_36",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -218,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_37",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -194,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_38",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -266,
    "z": 81
  },
  {
    "buildingId": "deco_fill_house_39",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -242,
    "z": 81
  },
  {
    "buildingId": "deco_fill_house_40",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -218,
    "z": 81
  },
  {
    "buildingId": "deco_fill_house_41",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -194,
    "z": 81
  },
  {
    "buildingId": "deco_fill_house_42",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -166,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_43",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -142,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_44",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -118,
    "z": 32
  },
  {
    "buildingId": "deco_fill_house_45",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -89,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_46",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -65,
    "z": 10
  },
  {
    "buildingId": "deco_fill_house_47",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -89,
    "z": 64
  },
  {
    "buildingId": "deco_fill_house_48",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -65,
    "z": 64
  },
  {
    "buildingId": "deco_fill_house_49",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -89,
    "z": 86
  },
  {
    "buildingId": "deco_fill_house_50",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -65,
    "z": 86
  },
  {
    "buildingId": "deco_fill_house_51",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -62,
    "z": 153
  },
  {
    "buildingId": "deco_fill_house_52",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -68,
    "z": 217
  },
  {
    "buildingId": "deco_fill_house_53",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -116,
    "z": 239
  },
  {
    "buildingId": "deco_fill_house_54",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 239
  },
  {
    "buildingId": "deco_fill_house_55",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -68,
    "z": 239
  },
  {
    "buildingId": "deco_fill_house_56",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -116,
    "z": 261
  },
  {
    "buildingId": "deco_fill_house_57",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 261
  },
  {
    "buildingId": "deco_fill_house_58",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -68,
    "z": 261
  },
  {
    "buildingId": "deco_fill_house_59",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -116,
    "z": 310
  },
  {
    "buildingId": "deco_fill_house_60",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 310
  },
  {
    "buildingId": "deco_fill_house_61",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -68,
    "z": 310
  },
  {
    "buildingId": "deco_fill_house_62",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -286
  },
  {
    "buildingId": "deco_fill_house_63",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": -286
  },
  {
    "buildingId": "deco_fill_house_64",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": -286
  },
  {
    "buildingId": "deco_fill_house_65",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": -248
  },
  {
    "buildingId": "deco_fill_house_66",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 53,
    "z": -283
  },
  {
    "buildingId": "deco_fill_house_67",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 77,
    "z": -283
  },
  {
    "buildingId": "deco_fill_house_68",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 53,
    "z": -261
  },
  {
    "buildingId": "deco_fill_house_69",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 77,
    "z": -261
  },
  {
    "buildingId": "deco_fill_house_70",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 53,
    "z": -239
  },
  {
    "buildingId": "deco_fill_house_71",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 77,
    "z": -239
  },
  {
    "buildingId": "deco_fill_house_72",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": -257
  },
  {
    "buildingId": "deco_fill_house_73",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 118,
    "z": -235
  },
  {
    "buildingId": "deco_fill_house_74",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": -235
  },
  {
    "buildingId": "deco_fill_short_apartment_0",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -23,
    "z": -169
  },
  {
    "buildingId": "deco_fill_short_apartment_1",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 7,
    "z": -169
  },
  {
    "buildingId": "deco_fill_short_apartment_2",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 52,
    "z": -169
  },
  {
    "buildingId": "deco_fill_house_75",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": -105
  },
  {
    "buildingId": "deco_fill_house_76",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -83
  },
  {
    "buildingId": "deco_fill_house_77",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": -83
  },
  {
    "buildingId": "deco_fill_house_78",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 42,
    "z": -125
  },
  {
    "buildingId": "deco_fill_house_79",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": -125
  },
  {
    "buildingId": "deco_fill_house_80",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 42,
    "z": -103
  },
  {
    "buildingId": "deco_fill_house_81",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": -103
  },
  {
    "buildingId": "deco_fill_house_82",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 42,
    "z": -81
  },
  {
    "buildingId": "deco_fill_house_83",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": -81
  },
  {
    "buildingId": "deco_fill_house_84",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 153,
    "z": -151
  },
  {
    "buildingId": "deco_fill_house_85",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 97,
    "z": -129
  },
  {
    "buildingId": "deco_fill_house_86",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 121,
    "z": -129
  },
  {
    "buildingId": "deco_fill_house_87",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 145,
    "z": -129
  },
  {
    "buildingId": "deco_fill_house_88",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 208,
    "z": -256
  },
  {
    "buildingId": "deco_fill_house_89",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 232,
    "z": -256
  },
  {
    "buildingId": "deco_fill_house_90",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 259,
    "z": -195
  },
  {
    "buildingId": "deco_fill_house_91",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 283,
    "z": -195
  },
  {
    "buildingId": "deco_fill_house_92",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 259,
    "z": -173
  },
  {
    "buildingId": "deco_fill_house_93",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 283,
    "z": -173
  },
  {
    "buildingId": "deco_fill_short_apartment_3",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 262,
    "z": -152
  },
  {
    "buildingId": "deco_fill_house_94",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 202,
    "z": -89
  },
  {
    "buildingId": "deco_fill_short_apartment_4",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 313,
    "z": -77
  },
  {
    "buildingId": "deco_fill_house_95",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 44,
    "z": 17
  },
  {
    "buildingId": "deco_fill_house_96",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": 17
  },
  {
    "buildingId": "deco_fill_house_97",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 92,
    "z": 17
  },
  {
    "buildingId": "deco_fill_house_98",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 116,
    "z": 17
  },
  {
    "buildingId": "deco_fill_house_99",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 89,
    "z": 128
  },
  {
    "buildingId": "deco_fill_house_100",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 113,
    "z": 128
  },
  {
    "buildingId": "deco_fill_house_101",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": -13
  },
  {
    "buildingId": "deco_fill_house_102",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 166,
    "z": -13
  },
  {
    "buildingId": "deco_fill_house_103",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 190,
    "z": -13
  },
  {
    "buildingId": "deco_fill_house_104",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": 9
  },
  {
    "buildingId": "deco_fill_house_105",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 166,
    "z": 9
  },
  {
    "buildingId": "deco_fill_house_106",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 190,
    "z": 9
  },
  {
    "buildingId": "deco_fill_house_107",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": 31
  },
  {
    "buildingId": "deco_fill_house_108",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 166,
    "z": 31
  },
  {
    "buildingId": "deco_fill_house_109",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 190,
    "z": 31
  },
  {
    "buildingId": "deco_fill_house_110",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 250,
    "z": -33
  },
  {
    "buildingId": "deco_fill_house_111",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 274,
    "z": -33
  },
  {
    "buildingId": "deco_fill_house_112",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": -11
  },
  {
    "buildingId": "deco_fill_house_113",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 250,
    "z": -11
  },
  {
    "buildingId": "deco_fill_house_114",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 274,
    "z": -11
  },
  {
    "buildingId": "deco_fill_house_115",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": 11
  },
  {
    "buildingId": "deco_fill_house_116",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 250,
    "z": 11
  },
  {
    "buildingId": "deco_fill_house_117",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 274,
    "z": 11
  },
  {
    "buildingId": "deco_fill_house_118",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": 33
  },
  {
    "buildingId": "deco_fill_house_119",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 250,
    "z": 33
  },
  {
    "buildingId": "deco_fill_house_120",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 274,
    "z": 33
  },
  {
    "buildingId": "deco_fill_house_121",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 142,
    "z": 133
  },
  {
    "buildingId": "deco_fill_house_122",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 166,
    "z": 133
  },
  {
    "buildingId": "deco_fill_house_123",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 258,
    "z": 105
  },
  {
    "buildingId": "deco_fill_house_124",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 208,
    "z": 127
  },
  {
    "buildingId": "deco_fill_house_125",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 232,
    "z": 127
  },
  {
    "buildingId": "deco_fill_house_126",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 256,
    "z": 127
  },
  {
    "buildingId": "deco_fill_house_127",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 327,
    "z": -55
  },
  {
    "buildingId": "deco_fill_short_apartment_5",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 306,
    "z": -34
  },
  {
    "buildingId": "deco_fill_house_128",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": 9
  },
  {
    "buildingId": "deco_fill_house_129",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 327,
    "z": 9
  },
  {
    "buildingId": "deco_fill_house_130",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 382,
    "z": 15
  },
  {
    "buildingId": "deco_fill_short_apartment_6",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -23,
    "z": 239
  },
  {
    "buildingId": "deco_fill_short_apartment_7",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 7,
    "z": 239
  },
  {
    "buildingId": "deco_fill_short_apartment_8",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 37,
    "z": 239
  },
  {
    "buildingId": "deco_fill_house_131",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 89,
    "z": 182
  },
  {
    "buildingId": "deco_fill_house_132",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 113,
    "z": 182
  },
  {
    "buildingId": "deco_fill_house_133",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": 260
  },
  {
    "buildingId": "deco_fill_house_134",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_135",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_136",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_137",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": 304
  },
  {
    "buildingId": "deco_fill_house_138",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": 304
  },
  {
    "buildingId": "deco_fill_house_139",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": 304
  },
  {
    "buildingId": "deco_fill_house_140",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": 326
  },
  {
    "buildingId": "deco_fill_house_141",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": 326
  },
  {
    "buildingId": "deco_fill_house_142",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 22,
    "z": 326
  },
  {
    "buildingId": "deco_fill_house_143",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_144",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 92,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_145",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 116,
    "z": 282
  },
  {
    "buildingId": "deco_fill_house_146",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 144,
    "z": 308
  },
  {
    "buildingId": "deco_fill_house_147",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 168,
    "z": 308
  },
  {
    "buildingId": "deco_fill_house_148",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 192,
    "z": 308
  },
  {
    "buildingId": "deco_fill_house_149",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 216,
    "z": 308
  },
  {
    "buildingId": "deco_fill_house_150",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -264,
    "z": -153
  },
  {
    "buildingId": "deco_fill_house_151",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -240,
    "z": -153
  },
  {
    "buildingId": "deco_fill_house_152",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -264,
    "z": -131
  },
  {
    "buildingId": "deco_fill_house_153",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -240,
    "z": -131
  },
  {
    "buildingId": "deco_fill_house_154",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -155
  },
  {
    "buildingId": "deco_fill_house_155",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -184,
    "z": -155
  },
  {
    "buildingId": "deco_fill_house_156",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -160,
    "z": -155
  },
  {
    "buildingId": "deco_fill_house_157",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -133
  },
  {
    "buildingId": "deco_fill_house_158",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -184,
    "z": -133
  },
  {
    "buildingId": "deco_fill_house_159",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -160,
    "z": -133
  },
  {
    "buildingId": "deco_fill_short_apartment_9",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -205,
    "z": -112
  },
  {
    "buildingId": "deco_fill_short_apartment_10",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -175,
    "z": -112
  }
];
