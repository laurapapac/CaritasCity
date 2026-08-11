/**
 * Static building layout — 158 buildings placed inside a recursively
 * subdivided block grid (see src/scripts/generateCityLayout.ts's "road
 * revision #2" doc comment for why). Position is a fixed design decision,
 * not runtime state — regenerate only if the layout design itself is being
 * revisited.
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
    "x": -185,
    "z": -175
  },
  {
    "buildingId": "school_1",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 137,
    "z": 188
  },
  {
    "buildingId": "school_2",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 245,
    "z": -120
  },
  {
    "buildingId": "school_3",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -183,
    "z": 132
  },
  {
    "buildingId": "school_4",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 65,
    "z": -270
  },
  {
    "buildingId": "school_5",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 3,
    "z": 51
  },
  {
    "buildingId": "school_6",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 248,
    "z": 45
  },
  {
    "buildingId": "school_7",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -250,
    "z": -6
  },
  {
    "buildingId": "school_8",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 3,
    "z": -139
  },
  {
    "buildingId": "school_9",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -136,
    "z": -49
  },
  {
    "buildingId": "school_10",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 149,
    "z": -26
  },
  {
    "buildingId": "school_11",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": -114,
    "z": -270
  },
  {
    "buildingId": "school_12",
    "variant": "school",
    "category": "school",
    "totalBlocks": 5000,
    "x": 147,
    "z": -188
  },
  {
    "buildingId": "food_bank_0",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -208,
    "z": -109
  },
  {
    "buildingId": "food_bank_1",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 217,
    "z": 103
  },
  {
    "buildingId": "food_bank_2",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -111,
    "z": 205
  },
  {
    "buildingId": "food_bank_3",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 60,
    "z": -250
  },
  {
    "buildingId": "food_bank_4",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 240,
    "z": -100
  },
  {
    "buildingId": "food_bank_5",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -2,
    "z": 71
  },
  {
    "buildingId": "food_bank_6",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -255,
    "z": 59
  },
  {
    "buildingId": "food_bank_7",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": 55,
    "z": 205
  },
  {
    "buildingId": "food_bank_8",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -119,
    "z": -250
  },
  {
    "buildingId": "food_bank_9",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -2,
    "z": -119
  },
  {
    "buildingId": "food_bank_10",
    "variant": "food_bank",
    "category": "food",
    "totalBlocks": 4000,
    "x": -124,
    "z": -6
  },
  {
    "buildingId": "hospital_medium_0",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6000,
    "x": -59,
    "z": -266
  },
  {
    "buildingId": "hospital_medium_1",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6000,
    "x": 181,
    "z": 192
  },
  {
    "buildingId": "hospital_medium_2",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6000,
    "x": -266,
    "z": 83
  },
  {
    "buildingId": "hospital_medium_3",
    "variant": "hospital_medium",
    "category": "hospital",
    "totalBlocks": 6000,
    "x": 229,
    "z": -74
  },
  {
    "buildingId": "hospital_large_0",
    "variant": "hospital_large",
    "category": "hospital",
    "totalBlocks": 8000,
    "x": -60,
    "z": -222
  },
  {
    "buildingId": "restaurant_0",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -264,
    "z": -109
  },
  {
    "buildingId": "restaurant_1",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 258,
    "z": 103
  },
  {
    "buildingId": "restaurant_2",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 51,
    "z": -229
  },
  {
    "buildingId": "restaurant_3",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -120,
    "z": 225
  },
  {
    "buildingId": "restaurant_4",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 187,
    "z": -120
  },
  {
    "buildingId": "restaurant_5",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -76,
    "z": -109
  },
  {
    "buildingId": "restaurant_6",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -236,
    "z": 79
  },
  {
    "buildingId": "restaurant_7",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 46,
    "z": 226
  },
  {
    "buildingId": "restaurant_8",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 70,
    "z": 46
  },
  {
    "buildingId": "restaurant_9",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -128,
    "z": -229
  },
  {
    "buildingId": "restaurant_10",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -70,
    "z": 61
  },
  {
    "buildingId": "restaurant_11",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 52,
    "z": -138
  },
  {
    "buildingId": "restaurant_12",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": 234,
    "z": -26
  },
  {
    "buildingId": "restaurant_13",
    "variant": "restaurant",
    "category": "food",
    "totalBlocks": 5000,
    "x": -199,
    "z": -154
  },
  {
    "buildingId": "short_apartment_0",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -265,
    "z": -53
  },
  {
    "buildingId": "hospital_small_0",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -218,
    "z": -56
  },
  {
    "buildingId": "short_apartment_1",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 207,
    "z": 124
  },
  {
    "buildingId": "hospital_small_1",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 237,
    "z": 124
  },
  {
    "buildingId": "short_apartment_2",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 82,
    "z": -230
  },
  {
    "buildingId": "hospital_small_2",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 50,
    "z": -208
  },
  {
    "buildingId": "short_apartment_3",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -121,
    "z": 246
  },
  {
    "buildingId": "hospital_small_3",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": -121,
    "z": 266
  },
  {
    "buildingId": "short_apartment_4",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 38,
    "z": 71
  },
  {
    "buildingId": "hospital_small_4",
    "variant": "hospital_small",
    "category": "hospital",
    "totalBlocks": 4000,
    "x": 258,
    "z": -78
  },
  {
    "buildingId": "short_apartment_5",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 186,
    "z": -99
  },
  {
    "buildingId": "short_apartment_6",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -97,
    "z": -230
  },
  {
    "buildingId": "short_apartment_7",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 77,
    "z": 225
  },
  {
    "buildingId": "short_apartment_8",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -200,
    "z": 59
  },
  {
    "buildingId": "short_apartment_9",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -45,
    "z": -109
  },
  {
    "buildingId": "short_apartment_10",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 83,
    "z": -139
  },
  {
    "buildingId": "short_apartment_11",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -168,
    "z": -155
  },
  {
    "buildingId": "short_apartment_12",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 233,
    "z": -5
  },
  {
    "buildingId": "short_apartment_13",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 69,
    "z": -26
  },
  {
    "buildingId": "short_apartment_14",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -12,
    "z": -199
  },
  {
    "buildingId": "short_apartment_15",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 60,
    "z": 103
  },
  {
    "buildingId": "short_apartment_16",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -151,
    "z": -29
  },
  {
    "buildingId": "short_apartment_17",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 192,
    "z": -188
  },
  {
    "buildingId": "short_apartment_18",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 122,
    "z": 216
  },
  {
    "buildingId": "short_apartment_19",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -198,
    "z": 152
  },
  {
    "buildingId": "short_apartment_20",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 194,
    "z": -26
  },
  {
    "buildingId": "short_apartment_21",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": 122,
    "z": 103
  },
  {
    "buildingId": "short_apartment_22",
    "variant": "short_apartment",
    "category": "residential",
    "totalBlocks": 4000,
    "x": -12,
    "z": -81
  },
  {
    "buildingId": "house_0",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -154,
    "z": -108
  },
  {
    "buildingId": "house_1",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 264,
    "z": 125
  },
  {
    "buildingId": "house_2",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -94,
    "z": 267
  },
  {
    "buildingId": "house_3",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 129,
    "z": -167
  },
  {
    "buildingId": "house_4",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -268,
    "z": 108
  },
  {
    "buildingId": "house_5",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 96,
    "z": -25
  },
  {
    "buildingId": "house_6",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": -269
  },
  {
    "buildingId": "house_7",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 42,
    "z": 247
  },
  {
    "buildingId": "house_8",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -42,
    "z": 62
  },
  {
    "buildingId": "house_9",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 260,
    "z": -4
  },
  {
    "buildingId": "house_10",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -268,
    "z": -87
  },
  {
    "buildingId": "house_11",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -132,
    "z": -208
  },
  {
    "buildingId": "house_12",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 15,
    "z": -80
  },
  {
    "buildingId": "house_13",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -171,
    "z": 153
  },
  {
    "buildingId": "house_14",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -203,
    "z": -5
  },
  {
    "buildingId": "house_15",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 87,
    "z": 104
  },
  {
    "buildingId": "house_16",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 48,
    "z": -117
  },
  {
    "buildingId": "house_17",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 183,
    "z": -78
  },
  {
    "buildingId": "house_18",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 149,
    "z": 217
  },
  {
    "buildingId": "house_19",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -203,
    "z": -133
  },
  {
    "buildingId": "house_20",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 131,
    "z": -5
  },
  {
    "buildingId": "house_21",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 149,
    "z": 104
  },
  {
    "buildingId": "house_22",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -80,
    "z": -87
  },
  {
    "buildingId": "house_23",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": 206
  },
  {
    "buildingId": "house_24",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -268,
    "z": 15
  },
  {
    "buildingId": "house_25",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -173,
    "z": 60
  },
  {
    "buildingId": "house_26",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 15,
    "z": -198
  },
  {
    "buildingId": "house_27",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 77,
    "z": -207
  },
  {
    "buildingId": "house_28",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 98,
    "z": 46
  },
  {
    "buildingId": "house_29",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 230,
    "z": 66
  },
  {
    "buildingId": "house_30",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -124,
    "z": 133
  },
  {
    "buildingId": "house_31",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -137,
    "z": 62
  },
  {
    "buildingId": "house_32",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -137,
    "z": 15
  },
  {
    "buildingId": "house_33",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -191,
    "z": -55
  },
  {
    "buildingId": "house_34",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 227,
    "z": -49
  },
  {
    "buildingId": "house_35",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 48,
    "z": -77
  },
  {
    "buildingId": "house_36",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -221,
    "z": -88
  },
  {
    "buildingId": "house_37",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -124,
    "z": -28
  },
  {
    "buildingId": "house_38",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -268,
    "z": -32
  },
  {
    "buildingId": "house_39",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 129,
    "z": -119
  },
  {
    "buildingId": "house_40",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -130,
    "z": -108
  },
  {
    "buildingId": "house_41",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -179,
    "z": -5
  },
  {
    "buildingId": "house_42",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -113,
    "z": 62
  },
  {
    "buildingId": "house_43",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -100,
    "z": 133
  },
  {
    "buildingId": "house_44",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 9,
    "z": -269
  },
  {
    "buildingId": "house_45",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 72,
    "z": -77
  },
  {
    "buildingId": "house_46",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 153,
    "z": -119
  },
  {
    "buildingId": "house_47",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 9,
    "z": 206
  },
  {
    "buildingId": "house_48",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -197,
    "z": -88
  },
  {
    "buildingId": "house_49",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -221,
    "z": -33
  },
  {
    "buildingId": "house_50",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -106,
    "z": -108
  },
  {
    "buildingId": "house_51",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -244,
    "z": 15
  },
  {
    "buildingId": "house_52",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -203,
    "z": 17
  },
  {
    "buildingId": "house_53",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -203,
    "z": 82
  },
  {
    "buildingId": "house_54",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -113,
    "z": 15
  },
  {
    "buildingId": "house_55",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -137,
    "z": 84
  },
  {
    "buildingId": "house_56",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -74,
    "z": 84
  },
  {
    "buildingId": "house_57",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -124,
    "z": 155
  },
  {
    "buildingId": "house_58",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": -247
  },
  {
    "buildingId": "house_59",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": -176
  },
  {
    "buildingId": "house_60",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 101,
    "z": -207
  },
  {
    "buildingId": "house_61",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": -58
  },
  {
    "buildingId": "house_62",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 96,
    "z": -77
  },
  {
    "buildingId": "house_63",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 129,
    "z": -97
  },
  {
    "buildingId": "house_64",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": -3
  },
  {
    "buildingId": "house_65",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 66,
    "z": 68
  },
  {
    "buildingId": "house_66",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 254,
    "z": 66
  },
  {
    "buildingId": "house_67",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 57,
    "z": 126
  },
  {
    "buildingId": "house_68",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -15,
    "z": 228
  },
  {
    "buildingId": "house_69",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": 173,
    "z": 104
  },
  {
    "buildingId": "house_70",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -197,
    "z": -33
  },
  {
    "buildingId": "house_71",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -154,
    "z": -86
  },
  {
    "buildingId": "house_72",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -56,
    "z": -87
  },
  {
    "buildingId": "house_73",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -268,
    "z": 37
  },
  {
    "buildingId": "house_74",
    "variant": "house",
    "category": "residential",
    "totalBlocks": 1080,
    "x": -179,
    "z": 17
  },
  {
    "buildingId": "tall_apartment_0",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -60,
    "z": -199
  },
  {
    "buildingId": "tall_apartment_1",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 174,
    "z": 216
  },
  {
    "buildingId": "tall_apartment_2",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -243,
    "z": 107
  },
  {
    "buildingId": "tall_apartment_3",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 252,
    "z": -50
  },
  {
    "buildingId": "tall_apartment_4",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -49,
    "z": 83
  },
  {
    "buildingId": "tall_apartment_5",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 49,
    "z": -56
  },
  {
    "buildingId": "tall_apartment_6",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 10,
    "z": 227
  },
  {
    "buildingId": "tall_apartment_7",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -129,
    "z": -87
  },
  {
    "buildingId": "tall_apartment_8",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 154,
    "z": -168
  },
  {
    "buildingId": "tall_apartment_9",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 91,
    "z": 67
  },
  {
    "buildingId": "tall_apartment_10",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": 205,
    "z": 146
  },
  {
    "buildingId": "tall_apartment_11",
    "variant": "tall_apartment",
    "category": "residential",
    "totalBlocks": 8000,
    "x": -200,
    "z": 174
  }
];
