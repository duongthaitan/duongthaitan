// Approximate courses of the major mountain ranges, as [longitude, latitude] polylines, for the
// relief shading on the README globe. Coarse on purpose: at 120px a range is a few pixels wide.
// `snow` marks the ranges high enough to show permanent snow from orbit.

export const RANGES = [
  { name: 'himalaya', snow: true, path: [[73, 35.5], [77, 34], [81, 30.5], [85, 28.2], [88, 27.8], [92, 27.8], [95, 28.6]] },
  { name: 'karakoram, hindu kush', snow: true, path: [[67.5, 35], [71, 36.4], [75, 36.4], [78, 35.3]] },
  { name: 'tian shan', snow: true, path: [[69.5, 41.2], [76, 42], [82, 43], [88, 43.4], [94, 43]] },
  { name: 'altai', path: [[84.5, 50.2], [89, 49.2], [94, 48], [98, 47]] },
  { name: 'kunlun', path: [[76, 36.6], [82, 36], [88, 36], [94, 35.7], [99, 35]] },
  { name: 'truong son', path: [[103.6, 20.4], [105.5, 18], [107.2, 15.6], [108.4, 12.8]] },
  { name: 'andes', snow: true, path: [[-74, 10.5], [-77.5, 4], [-78.8, -1.5], [-77, -9], [-72, -14.5], [-68.5, -19], [-68, -25], [-69.8, -31], [-70.6, -36], [-71.6, -42], [-73, -48], [-73.5, -52]] },
  { name: 'rockies', snow: true, path: [[-129, 59], [-122, 54], [-117.5, 50], [-114.2, 46], [-110.5, 42], [-107, 38.2], [-106, 34], [-105.4, 30.5]] },
  { name: 'sierra madre', path: [[-108.5, 28.5], [-105.2, 24], [-101, 20], [-97.5, 17.6]] },
  { name: 'appalachians', path: [[-85.6, 33.6], [-81.5, 36.5], [-78, 39.5], [-74.5, 42.4], [-70.5, 45.5]] },
  { name: 'alps', snow: true, path: [[5.8, 44.4], [7.4, 45.9], [10.5, 46.6], [13.8, 47.1]] },
  { name: 'pyrenees', path: [[-1.6, 43], [0.8, 42.7], [2.8, 42.4]] },
  { name: 'caucasus', snow: true, path: [[39.8, 43.6], [43.4, 42.9], [47.8, 41.4]] },
  { name: 'urals', path: [[58.8, 50.5], [59.2, 56], [59.8, 61.5], [63.8, 67]] },
  { name: 'zagros', path: [[44.6, 36.6], [48.6, 33], [52.6, 29.4], [56.8, 27.4]] },
  { name: 'atlas', path: [[-9.4, 30.4], [-5.4, 32.6], [0.8, 34.2], [7.6, 35.4]] },
  { name: 'ethiopian and east african highlands', path: [[38.4, 14], [39.6, 10], [38, 6], [36.6, 1], [35.4, -4], [34.4, -9]] },
  { name: 'drakensberg', path: [[26.8, -33.4], [28.8, -30.4], [30.6, -27.2]] },
  { name: 'great dividing range', path: [[145.2, -15.6], [146.8, -20.2], [149.4, -26.8], [150.2, -32], [148.4, -37]] },
  { name: 'scandinavian mountains', path: [[6.6, 59.4], [9, 62], [13.6, 65], [17.6, 68], [20.6, 69.6]] },
  { name: 'brazilian highlands', path: [[-48.6, -11], [-45.6, -16], [-43.6, -20.4], [-46, -23.4]] },
];

// The Tibetan plateau, a raised block rather than a line.
export const PLATEAUS = [
  [[78.5, 35.4], [86, 36], [93, 35.6], [100, 33.4], [100.6, 29.4], [95, 28.9], [88.4, 28.6], [82, 30.4], [78.6, 32.6]],
];
