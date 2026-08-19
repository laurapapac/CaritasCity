/**
 * Static building layout — 160 real (backend/QR-linked) buildings placed
 * inside a recursively subdivided block grid (see
 * src/scripts/generateCityLayout.ts's "road revision #2" doc comment for
 * why). Position is a fixed design decision, not runtime state — regenerate
 * only if the layout design itself is being revisited. Decoration-only
 * buildings (never backend-linked) live in the separate cityDecorBuildings.ts
 * — see that file's own header for why it's kept apart from this one.
 */

export type BuildingCategory = "residential" | "hospital" | "food" | "school";

export interface CityLayoutEntry {
  /** Stable key: `${variant}_${i}`, i 0-indexed within variant — matches
   *  server/src/scripts/seed.ts's (variant, order_index) natural key. */
  buildingId: string;
  variant: string;
  category: BuildingCategory;
  totalBlocks: number;
  x: number;
  z: number;
}

export const CITY_LAYOUT: CityLayoutEntry[] = [
  {
    "buildingId": "school_0",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -313,
    "z": -254
  },
  {
    "buildingId": "school_1",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 365,
    "z": 100
  },
  {
    "buildingId": "school_2",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -172,
    "z": 280
  },
  {
    "buildingId": "school_3",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 127,
    "z": -390
  },
  {
    "buildingId": "school_4",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -370,
    "z": 41
  },
  {
    "buildingId": "school_5",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 83,
    "z": 159
  },
  {
    "buildingId": "school_6",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -8,
    "z": -148
  },
  {
    "buildingId": "school_7",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 247,
    "z": -132
  },
  {
    "buildingId": "school_8",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -84,
    "z": -350
  },
  {
    "buildingId": "school_9",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -148,
    "z": 72
  },
  {
    "buildingId": "school_10",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -8,
    "z": 349
  },
  {
    "buildingId": "school_11",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -190,
    "z": -161
  },
  {
    "buildingId": "school_12",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 115,
    "z": -211
  },
  {
    "buildingId": "school_13",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 162,
    "z": 258
  },
  {
    "buildingId": "school_14",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 226,
    "z": 62
  },
  {
    "buildingId": "school_15",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -8,
    "z": -249
  },
  {
    "buildingId": "school_16",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 275,
    "z": 159
  },
  {
    "buildingId": "school_17",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -248,
    "z": -13
  },
  {
    "buildingId": "school_18",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 370,
    "z": -141
  },
  {
    "buildingId": "school_19",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 196,
    "z": -319
  },
  {
    "buildingId": "school_20",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 83,
    "z": 52
  },
  {
    "buildingId": "school_21",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -264,
    "z": 216
  },
  {
    "buildingId": "school_22",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -176,
    "z": -295
  },
  {
    "buildingId": "school_23",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 115,
    "z": -100
  },
  {
    "buildingId": "school_24",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -98,
    "z": 216
  },
  {
    "buildingId": "food_bank_0",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -258,
    "z": -254
  },
  {
    "buildingId": "food_bank_1",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 360,
    "z": 120
  },
  {
    "buildingId": "food_bank_2",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -177,
    "z": 300
  },
  {
    "buildingId": "food_bank_3",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 191,
    "z": -299
  },
  {
    "buildingId": "food_bank_4",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -315,
    "z": 41
  },
  {
    "buildingId": "food_bank_5",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 78,
    "z": 179
  },
  {
    "buildingId": "food_bank_6",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -13,
    "z": -128
  },
  {
    "buildingId": "food_bank_7",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -13,
    "z": -390
  },
  {
    "buildingId": "food_bank_8",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 365,
    "z": -121
  },
  {
    "buildingId": "food_bank_9",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -153,
    "z": 92
  },
  {
    "buildingId": "hospital_medium_0",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -269,
    "z": -194
  },
  {
    "buildingId": "hospital_medium_1",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 319,
    "z": 163
  },
  {
    "buildingId": "hospital_medium_2",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -280,
    "z": 270
  },
  {
    "buildingId": "hospital_medium_3",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 265,
    "z": -275
  },
  {
    "buildingId": "hospital_medium_4",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 26,
    "z": -386
  },
  {
    "buildingId": "hospital_medium_5",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -87,
    "z": 45
  },
  {
    "buildingId": "hospital_medium_6",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 36,
    "z": 353
  },
  {
    "buildingId": "hospital_medium_7",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 354,
    "z": -52
  },
  {
    "buildingId": "hospital_medium_8",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": -386,
    "z": 65
  },
  {
    "buildingId": "hospital_medium_9",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6100,
    "x": 44,
    "z": -144
  },
  {
    "buildingId": "hospital_large_0",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -144,
    "z": -387
  },
  {
    "buildingId": "hospital_large_1",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": 69,
    "z": 323
  },
  {
    "buildingId": "restaurant_0",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -190,
    "z": -341
  },
  {
    "buildingId": "restaurant_1",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 98,
    "z": 320
  },
  {
    "buildingId": "restaurant_2",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 356,
    "z": -100
  },
  {
    "buildingId": "restaurant_3",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -384,
    "z": 114
  },
  {
    "buildingId": "restaurant_4",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -57,
    "z": 41
  },
  {
    "buildingId": "restaurant_5",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 113,
    "z": -369
  },
  {
    "buildingId": "restaurant_6",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -339,
    "z": -160
  },
  {
    "buildingId": "restaurant_7",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 101,
    "z": -80
  },
  {
    "buildingId": "restaurant_8",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 261,
    "z": 187
  },
  {
    "buildingId": "restaurant_9",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -125,
    "z": 334
  },
  {
    "buildingId": "restaurant_10",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -125,
    "z": -160
  },
  {
    "buildingId": "restaurant_11",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 267,
    "z": -250
  },
  {
    "buildingId": "restaurant_12",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 359,
    "z": 43
  },
  {
    "buildingId": "restaurant_13",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -202,
    "z": -12
  },
  {
    "buildingId": "restaurant_14",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 69,
    "z": 105
  },
  {
    "buildingId": "restaurant_15",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -278,
    "z": 236
  },
  {
    "buildingId": "restaurant_16",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -22,
    "z": -309
  },
  {
    "buildingId": "short_apartment_0",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -99,
    "z": -390
  },
  {
    "buildingId": "hospital_small_0",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -191,
    "z": -232
  },
  {
    "buildingId": "short_apartment_1",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 71,
    "z": 346
  },
  {
    "buildingId": "hospital_small_1",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 292,
    "z": 187
  },
  {
    "buildingId": "short_apartment_2",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -385,
    "z": 135
  },
  {
    "buildingId": "hospital_small_2",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -251,
    "z": 266
  },
  {
    "buildingId": "short_apartment_3",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 355,
    "z": -80
  },
  {
    "buildingId": "hospital_small_3",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 313,
    "z": -218
  },
  {
    "buildingId": "short_apartment_4",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -126,
    "z": -90
  },
  {
    "buildingId": "hospital_small_4",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -385,
    "z": -13
  },
  {
    "buildingId": "short_apartment_5",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 100,
    "z": -191
  },
  {
    "buildingId": "hospital_small_5",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -86,
    "z": 69
  },
  {
    "buildingId": "short_apartment_6",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -328,
    "z": -234
  },
  {
    "buildingId": "hospital_small_6",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 56,
    "z": -390
  },
  {
    "buildingId": "hospital_small_7",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -23,
    "z": 377
  },
  {
    "buildingId": "hospital_small_8",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 132,
    "z": -80
  },
  {
    "buildingId": "hospital_small_9",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 306,
    "z": -14
  },
  {
    "buildingId": "hospital_small_10",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -142,
    "z": -364
  },
  {
    "buildingId": "hospital_small_11",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 100,
    "z": 105
  },
  {
    "buildingId": "house_0",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -107,
    "z": -294
  },
  {
    "buildingId": "house_1",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 98,
    "z": 347
  },
  {
    "buildingId": "house_2",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 382,
    "z": -79
  },
  {
    "buildingId": "house_3",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -339,
    "z": 115
  },
  {
    "buildingId": "house_4",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -343,
    "z": -139
  },
  {
    "buildingId": "house_5",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 73
  },
  {
    "buildingId": "house_6",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 319,
    "z": 188
  },
  {
    "buildingId": "house_7",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 228,
    "z": -298
  },
  {
    "buildingId": "house_8",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -166,
    "z": -12
  },
  {
    "buildingId": "house_9",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": 355
  },
  {
    "buildingId": "house_10",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 70,
    "z": -147
  },
  {
    "buildingId": "house_11",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 387,
    "z": 43
  },
  {
    "buildingId": "house_12",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 83,
    "z": -389
  },
  {
    "buildingId": "house_13",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -208,
    "z": -140
  },
  {
    "buildingId": "house_14",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": 218
  },
  {
    "buildingId": "house_15",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -224,
    "z": 267
  },
  {
    "buildingId": "house_16",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -315,
    "z": -12
  },
  {
    "buildingId": "house_17",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -166,
    "z": 125
  },
  {
    "buildingId": "house_18",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 226,
    "z": -55
  },
  {
    "buildingId": "house_19",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 144,
    "z": 160
  },
  {
    "buildingId": "house_20",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -221,
    "z": -253
  },
  {
    "buildingId": "house_21",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 178,
    "z": -131
  },
  {
    "buildingId": "house_22",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 259,
    "z": -217
  },
  {
    "buildingId": "house_23",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -72,
    "z": -389
  },
  {
    "buildingId": "house_24",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 268,
    "z": 63
  },
  {
    "buildingId": "house_25",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 127,
    "z": -190
  },
  {
    "buildingId": "house_26",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -266,
    "z": 59
  },
  {
    "buildingId": "house_27",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -162,
    "z": -340
  },
  {
    "buildingId": "house_28",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -210
  },
  {
    "buildingId": "house_29",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 204,
    "z": 259
  },
  {
    "buildingId": "house_30",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -56,
    "z": 217
  },
  {
    "buildingId": "house_31",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 53,
    "z": -305
  },
  {
    "buildingId": "house_32",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -59,
    "z": 70
  },
  {
    "buildingId": "house_33",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -259,
    "z": -91
  },
  {
    "buildingId": "house_34",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 4,
    "z": 378
  },
  {
    "buildingId": "house_35",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -69
  },
  {
    "buildingId": "house_36",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -388,
    "z": -92
  },
  {
    "buildingId": "house_37",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 85,
    "z": -55
  },
  {
    "buildingId": "house_38",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -190,
    "z": 217
  },
  {
    "buildingId": "house_39",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 380,
    "z": -55
  },
  {
    "buildingId": "house_40",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 218
  },
  {
    "buildingId": "house_41",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 6,
    "z": -308
  },
  {
    "buildingId": "house_42",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -360,
    "z": 62
  },
  {
    "buildingId": "house_43",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -164,
    "z": -231
  },
  {
    "buildingId": "house_44",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": 101
  },
  {
    "buildingId": "house_45",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -301,
    "z": -233
  },
  {
    "buildingId": "house_46",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -116,
    "z": 93
  },
  {
    "buildingId": "house_47",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -264,
    "z": -160
  },
  {
    "buildingId": "house_48",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 229,
    "z": -111
  },
  {
    "buildingId": "house_49",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 178,
    "z": -217
  },
  {
    "buildingId": "house_50",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": 260
  },
  {
    "buildingId": "house_51",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -280,
    "z": 171
  },
  {
    "buildingId": "house_52",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -266,
    "z": 9
  },
  {
    "buildingId": "house_53",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 141,
    "z": -369
  },
  {
    "buildingId": "house_54",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 118,
    "z": -305
  },
  {
    "buildingId": "house_55",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -129,
    "z": -139
  },
  {
    "buildingId": "house_56",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 49,
    "z": -210
  },
  {
    "buildingId": "house_57",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -107
  },
  {
    "buildingId": "house_58",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -358,
    "z": -12
  },
  {
    "buildingId": "house_59",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": -55
  },
  {
    "buildingId": "house_60",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -116,
    "z": 288
  },
  {
    "buildingId": "house_61",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -140,
    "z": 301
  },
  {
    "buildingId": "house_62",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -226,
    "z": 115
  },
  {
    "buildingId": "house_63",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 209,
    "z": 160
  },
  {
    "buildingId": "house_64",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 97,
    "z": -151
  },
  {
    "buildingId": "house_65",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 340,
    "z": -217
  },
  {
    "buildingId": "house_66",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -134,
    "z": -294
  },
  {
    "buildingId": "house_67",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 303,
    "z": 43
  },
  {
    "buildingId": "house_68",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 65,
    "z": 127
  },
  {
    "buildingId": "house_69",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 68,
    "z": 260
  },
  {
    "buildingId": "house_70",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -26,
    "z": -351
  },
  {
    "buildingId": "house_71",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -89,
    "z": 334
  },
  {
    "buildingId": "house_72",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -280,
    "z": 115
  },
  {
    "buildingId": "house_73",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 310,
    "z": -140
  },
  {
    "buildingId": "house_74",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -250,
    "z": 237
  },
  {
    "buildingId": "tall_apartment_0",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -337,
    "z": -93
  },
  {
    "buildingId": "tall_apartment_1",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 356,
    "z": 64
  }
];
