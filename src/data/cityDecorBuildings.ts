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
    "x": -71,
    "z": 9
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
    "x": 160,
    "z": 104
  },
  {
    "buildingId": "deco_school_8",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 127,
    "z": -327
  },
  {
    "buildingId": "deco_school_9",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -74,
    "z": 216
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
    "x": -206,
    "z": -87
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
    "x": 67,
    "z": 78
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
    "x": 289,
    "z": -254
  },
  {
    "buildingId": "deco_hospital_medium_7",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -136,
    "z": -291
  },
  {
    "buildingId": "deco_hospital_medium_8",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 0,
    "z": -144
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
    "x": -302,
    "z": 65
  },
  {
    "buildingId": "deco_hospital_medium_11",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -56,
    "z": 128
  },
  {
    "buildingId": "deco_hospital_large_0",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 86,
    "z": -53
  },
  {
    "buildingId": "deco_hospital_large_1",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -387,
    "z": -68
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
    "x": 311,
    "z": -193
  },
  {
    "buildingId": "deco_hospital_large_5",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 145,
    "z": 289
  },
  {
    "buildingId": "deco_restaurant_0",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 307,
    "z": -13
  },
  {
    "buildingId": "deco_restaurant_1",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -384,
    "z": -45
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
    "x": 2,
    "z": -351
  },
  {
    "buildingId": "deco_restaurant_4",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -61,
    "z": 41
  },
  {
    "buildingId": "deco_restaurant_5",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 174,
    "z": 286
  },
  {
    "buildingId": "deco_restaurant_6",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 133,
    "z": -151
  },
  {
    "buildingId": "deco_restaurant_7",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -276,
    "z": 193
  },
  {
    "buildingId": "deco_restaurant_8",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -125,
    "z": -138
  },
  {
    "buildingId": "deco_restaurant_9",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 314,
    "z": -170
  },
  {
    "buildingId": "deco_restaurant_10",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 146,
    "z": 125
  },
  {
    "buildingId": "deco_restaurant_11",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -262,
    "z": 10
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
    "z": -133
  },
  {
    "buildingId": "deco_hospital_small_1",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 383,
    "z": -34
  },
  {
    "buildingId": "deco_short_apartment_1",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 355,
    "z": -6
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
    "x": 56,
    "z": -336
  },
  {
    "buildingId": "deco_short_apartment_3",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 80,
    "z": -306
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
    "x": 96,
    "z": 74
  },
  {
    "buildingId": "deco_hospital_small_5",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 205,
    "z": 286
  },
  {
    "buildingId": "deco_short_apartment_5",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -277,
    "z": 136
  },
  {
    "buildingId": "deco_hospital_small_6",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -191,
    "z": -267
  },
  {
    "buildingId": "deco_short_apartment_6",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -141,
    "z": -319
  },
  {
    "buildingId": "deco_hospital_small_7",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -163,
    "z": 152
  },
  {
    "buildingId": "deco_short_apartment_7",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -73,
    "z": -68
  },
  {
    "buildingId": "deco_hospital_small_8",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 181,
    "z": -110
  },
  {
    "buildingId": "deco_short_apartment_8",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 181,
    "z": -90
  },
  {
    "buildingId": "deco_hospital_small_9",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 177,
    "z": 124
  },
  {
    "buildingId": "deco_short_apartment_9",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -109,
    "z": 152
  },
  {
    "buildingId": "deco_short_apartment_10",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 95,
    "z": 259
  },
  {
    "buildingId": "deco_short_apartment_11",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -361,
    "z": -13
  },
  {
    "buildingId": "deco_short_apartment_12",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 267,
    "z": 62
  },
  {
    "buildingId": "deco_short_apartment_13",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -80,
    "z": -208
  },
  {
    "buildingId": "deco_short_apartment_14",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 231,
    "z": -277
  },
  {
    "buildingId": "deco_short_apartment_15",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 69,
    "z": -148
  },
  {
    "buildingId": "deco_short_apartment_16",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -231,
    "z": 9
  },
  {
    "buildingId": "deco_short_apartment_17",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -181,
    "z": -141
  },
  {
    "buildingId": "deco_short_apartment_18",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 262,
    "z": -196
  },
  {
    "buildingId": "deco_short_apartment_19",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 253,
    "z": -56
  },
  {
    "buildingId": "deco_house_0",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -240,
    "z": -160
  },
  {
    "buildingId": "deco_house_1",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 382,
    "z": -5
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
    "x": 83,
    "z": -335
  },
  {
    "buildingId": "deco_house_4",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 44,
    "z": -33
  },
  {
    "buildingId": "deco_house_5",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -388,
    "z": 90
  },
  {
    "buildingId": "deco_house_6",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -82,
    "z": 153
  },
  {
    "buildingId": "deco_house_7",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 119,
    "z": 238
  },
  {
    "buildingId": "deco_house_8",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 259,
    "z": -175
  },
  {
    "buildingId": "deco_house_9",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -53,
    "z": -207
  },
  {
    "buildingId": "deco_house_10",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 208,
    "z": 85
  },
  {
    "buildingId": "deco_house_11",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 121,
    "z": -190
  },
  {
    "buildingId": "deco_house_12",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -69
  },
  {
    "buildingId": "deco_house_13",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -204,
    "z": 10
  },
  {
    "buildingId": "deco_house_14",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 196,
    "z": -35
  },
  {
    "buildingId": "deco_house_15",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 178,
    "z": -256
  },
  {
    "buildingId": "deco_house_16",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -338,
    "z": -52
  },
  {
    "buildingId": "deco_house_17",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -164,
    "z": -266
  },
  {
    "buildingId": "deco_house_18",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 128
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
    "x": -116,
    "z": 239
  },
  {
    "buildingId": "deco_house_21",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -286
  },
  {
    "buildingId": "deco_house_22",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -119
  },
  {
    "buildingId": "deco_house_23",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 310,
    "z": -118
  },
  {
    "buildingId": "deco_house_24",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -142,
    "z": -12
  },
  {
    "buildingId": "deco_house_25",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 327,
    "z": 43
  },
  {
    "buildingId": "deco_house_26",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": -33
  },
  {
    "buildingId": "deco_house_27",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -62
  },
  {
    "buildingId": "deco_house_28",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": -190
  },
  {
    "buildingId": "deco_house_29",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 53,
    "z": -283
  },
  {
    "buildingId": "deco_house_30",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -117
  },
  {
    "buildingId": "deco_house_31",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -291,
    "z": -12
  },
  {
    "buildingId": "deco_house_32",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -136,
    "z": 153
  },
  {
    "buildingId": "deco_house_33",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -89,
    "z": 64
  },
  {
    "buildingId": "deco_house_34",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -83,
    "z": -274
  },
  {
    "buildingId": "deco_house_35",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -2,
    "z": 218
  },
  {
    "buildingId": "deco_house_36",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -242,
    "z": 59
  },
  {
    "buildingId": "deco_house_37",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 118,
    "z": -257
  },
  {
    "buildingId": "deco_house_38",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -154,
    "z": -140
  },
  {
    "buildingId": "deco_house_39",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 73,
    "z": -210
  },
  {
    "buildingId": "deco_house_40",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 42,
    "z": -125
  },
  {
    "buildingId": "deco_house_41",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -388,
    "z": 10
  },
  {
    "buildingId": "deco_house_42",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 327,
    "z": -55
  },
  {
    "buildingId": "deco_house_43",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": -5
  },
  {
    "buildingId": "deco_house_44",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -92,
    "z": 288
  },
  {
    "buildingId": "deco_house_45",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": 123
  },
  {
    "buildingId": "deco_house_46",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 97,
    "z": -130
  },
  {
    "buildingId": "deco_house_47",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 342,
    "z": -169
  },
  {
    "buildingId": "deco_house_48",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": 282
  },
  {
    "buildingId": "deco_house_49",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -84,
    "z": -138
  },
  {
    "buildingId": "deco_tall_apartment_0",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -300,
    "z": -70
  },
  {
    "buildingId": "deco_tall_apartment_1",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 304,
    "z": 64
  },
  {
    "buildingId": "deco_tall_apartment_2",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -67,
    "z": 287
  },
  {
    "buildingId": "deco_tall_apartment_3",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 78,
    "z": -284
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
    "x": -139,
    "z": -267
  },
  {
    "buildingId": "deco_tall_apartment_6",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 284,
    "z": -176
  },
  {
    "buildingId": "deco_tall_apartment_7",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 93,
    "z": 281
  },
  {
    "buildingId": "deco_tall_apartment_8",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -104,
    "z": -70
  },
  {
    "buildingId": "deco_tall_apartment_9",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -57,
    "z": 152
  }
];
