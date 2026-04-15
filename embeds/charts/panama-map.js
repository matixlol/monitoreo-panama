import * as d3 from 'd3';

export const PANAMA_PROVINCE_NAMES = new Map([
  ['g18', 'Bocas del Toro'],
  ['cocle', 'Coclé'],
  ['colon', 'Colón'],
  ['chiriqui', 'Chiriquí'],
  ['darien', 'Darién'],
  ['herrera', 'Herrera'],
  ['los_santos', 'Los Santos'],
  ['panama', 'Panamá'],
  ['veraguas', 'Veraguas'],
  ['panama_oeste', 'Panamá Oeste'],
  ['embera_wounaan', 'Emberá-Wounaan'],
  ['guna_yala', 'Guna Yala'],
  ['naso_tjer_di', 'Naso Tjër Di'],
  ['ngabe_bugle', 'Ngäbe-Buglé'],
]);

const PANAMA_LABEL_SELECTORS = new Map([
  ['g18', '#t_bocas_del_toro'],
  ['cocle', '#t_cocle'],
  ['colon', '#t_colon'],
  ['chiriqui', '#t_chiriqui'],
  ['darien', '#text26'],
  ['herrera', '#t_herrera'],
  ['los_santos', '#t_los_santos'],
  ['panama', '#t_panama'],
  ['veraguas', '#t_veraguas'],
  ['panama_oeste', '#t_panama_oeste'],
  ['embera_wounaan', '#t_embera_wounaan'],
  ['guna_yala', '#t_guna_yala'],
  ['naso_tjer_di', '#t_naso_tjer_di'],
  ['ngabe_bugle', '#t_ngabe_bugle'],
]);

const PANAMA_MAP_MARKUP = '<g id="wrapper-1">\n          <g id="wrapper-2">\n            <polygon\n               points="455.3,617.2 496.1,617.2 555.6,676.7 608,676.7 632.1,700.8 702.3,700.8 735.2,668 783.8,668 783.8,722.5 755.3,751.2 755.3,798.3 706.6,846.9 600.5,740.8 483.2,740.8 459.9,764.1 431.7,735.8 349.7,735.8 290.3,676.5 136.3,676.5 100.1,712.7 100.1,825 67.1,792.9 67.1,715.2 33.5,681.6 126.7,588.4 126.7,518.8 79.8,470.8 168,382.6 230.5,382.6 285.3,437.5 365.7,437.5 384.6,455.7 455.3,455.7 "\n               id="chiriqui" />\n\n            <polygon\n               points="2664.2,385.6 2720.9,442.1 2847.5,568.8 2907.5,508.7 2907.5,485.8 2837.8,485.8 2552.5,200.5 2512.5,200.5 2485.8,173.8 2448.2,173.8 2409,134.7 2346.8,134.7 2316.4,104.3 2052.5,104.3 2033.7,85.5 2072.4,46.7 2016.6,46.7 2016.6,93.9 1930.5,180.2 2100.2,180.2 2143.2,137.3 2189,137.3 2210.1,158.5 2289.6,158.5 2325.2,194 2394.5,194 2435.9,235.4 2491.2,235.4 2538.5,282.8 2641.4,385.6 "\n               id="guna_yala" />\n\n            <polygon\n               points="1326.8,877.2 1304,877.2 1239.3,941.9 1286.6,989.2 1194.2,1081.5 1173.1,1060.5 1144.8,1060.5 1074.6,990.2 1074.6,893.5 1127.8,840.3 1127.8,813.4 1182.1,758.9 1209.7,786.3 1290.1,786.3 1308.2,803.9 1354.2,849.8 "\n               id="herrera" />\n\n            <polygon\n               points="1396.5,872.2 1396.5,902.6 1561.1,1067.2 1561.1,1134.7 1408.9,1134.7 1367.3,1176.3 1383.5,1192.4 1339.2,1236.6 1243.3,1236.6 1243.3,1209.5 1194.2,1160.3 1194.2,1081.5 1286.6,989.2 1239.3,941.9 1304,877.2 1326.8,877.2 1354.2,849.8 1374,849.8 "\n               id="los_santos" />\n\n            <polygon\n               points="154.7,111.8 178.1,88.4 250.1,160.3 226.7,183.8 226.7,266.1 194.8,297.9 178.5,297.9 145.1,331.3 99.9,286.1 66.6,286.1 66.6,92.6 120.8,92.3 120.8,111.8 "\n               id="naso_tjer_di" />\n\n            <polygon\n               points="321.6,337.1 390.6,268 390.6,338.8 464.5,412.7 508.7,368.5 669.7,368.5 589.8,288.6 589.8,239.8 794.7,444.7 946.7,444.7 946.7,557.2 963,573.5 963,622 842.9,622 815.7,649.1 783.8,649.1 783.8,668 735.2,668 702.3,700.8 632.1,700.8 608,676.7 555.6,676.7 496.1,617.2 455.3,617.2 455.3,455.7 384.6,455.7 365.7,437.5 365.7,381.2 "\n               id="ngabe_bugle" />\n\n            <polygon\n               points="1589.6,242 1563.7,267.9 1563.7,290.9 1579.9,307.1 1579.9,340.1 1564.2,355.8 1525.7,355.8 1506.5,336.7 1477.4,365.8 1477.4,478.8 1510.6,512 1510.6,605.9 1539.1,634.4 1608.1,565.3 1646.4,565.3 1677.7,533.9 1654.6,510.8 1682.3,483.2 1682.3,414.1 1711.6,384.8 1774.4,384.8 1774.4,356.6 1705.7,287.6 1705.9,275.8 1662.7,275.8 1628.9,242 "\n               id="panama_oeste" />\n\n            <g id="veraguas">\n               <polygon\n                  points="755.3,973.9 799,1017.6 889.9,1017.6 925.8,1053.5 953.6,1025.7 953.6,921.5 1015.3,921.5 1015.3,1029.2 1080.7,1094.6 1080.7,1207.2 1110.1,1236.6 1243.3,1236.6 1243.3,1209.5 1194.2,1160.3 1194.2,1081.5 1173.1,1060.5 1144.8,1060.5 1074.6,990.2 1074.6,893.5 1127.8,840.3 1127.8,813.4 1182.1,758.9 1182.3,621.5 1133.5,572.7 1171.2,534.9 1171.2,465.2 1106.4,400.4 1057.9,400.4 1013.4,444.8 946.7,444.8 946.7,557.2 963,573.5 963,622 842.9,622 815.7,649.1 783.8,649.1 783.8,668 783.8,722.5 755.1,751.1 755.1,798.3 706.6,846.9 755.3,895.6 "\n                  id="polygon8" />\n\n               <polygon\n                  points="595.6,1125.3 653.1,1182.8 740.4,1182.8 714.7,1157.1 692.3,1157.1 692.3,1103.6 714.5,1081.4 661.4,1027.3 595.6,1093 "\n                  id="polygon9" />\n            </g>\n\n            <g id="panama">\n               <polygon\n                  points="1828.1,326.7 2021.3,326.7 2130.7,436.1 2184.6,436.1 2250.6,502.1 2293.5,502.1 2293.5,593.5 2360.9,660.8 2360.9,606.8 2327.5,573.4 2327.5,459.2 2378.8,407.9 2417.1,407.9 2460.2,364.9 2503.5,364.9 2503.5,317.8 2538.5,282.8 2491.2,235.4 2435.9,235.4 2394.5,194 2325.2,194 2289.6,158.5 2210.1,158.5 2189,137.3 2143.2,137.3 2100.2,180.2 1930.5,180.2 1930.5,133.7 1902.3,105.5 1883.7,124.1 1859.8,124.1 1859.8,85.7 1786.9,85.7 1786.9,144.5 1759.1,172.2 1759.1,222.5 1705.9,275.8 1705.7,287.6 1774.4,356.6 1798.2,356.6 "\n                  id="polygon10" />\n\n               <polygon\n                  points="2109.7,731.2 2109.7,694.7 2136.3,694.7 2153.6,677.4 2153.6,640.4 2124.5,611.4 2072,611.7 2072,693.5 "\n                  id="polygon11" />\n            </g>\n\n            <path\n               d="m 2965,817.1 v -54.6 l -20.3,-20.3 -16.5,-16.5 -84.4,84.4 H 2787 l -29.4,-29.4 V 745.8 L 2666,654.2 v -47.4 l -74.2,-74.2 90.4,-90.4 h 38.7 l -56.6,-56.5 h -22.8 L 2538.6,282.9 2503.5,318 v 47 h -43.3 l -43,43 h -38.3 l -51.4,51.4 v 114.1 l 33.4,33.4 V 661 l 17.4,17.4 v -36.9 l 30,-30 h 38.1 l 24.3,24.3 v 43 l -49.1,49.1 35.5,35.5 -54.7,54.7 -34.7,-34.7 -18.6,18.6 v 82.4 l 77.1,77.1 v 63.8 l 204.6,204.6 v -119.3 h 85.6 V 995.1 l 85.6,85.6 131.3,-131.3 -32.8,-32.8 37.5,-37.5 h 60.6 v -28.5 z m -364.7,233.2 H 2526 v -39.9 h -47.3 l -27.5,-27.5 v -43.3 l -50.8,-50.8 34.7,-38 h 22.6 v -35.6 l 15.3,-15.3 78.4,78.4 18.4,-18.4 v 68 l 30.7,30.7 v 91.7 z"\n               id="darien" />\n\n            <polygon\n               points="1367.6,408.7 1332.1,373.2 1283.5,373.2 1283.5,442.7 1226,442.7 1199.5,469.1 1199.5,506.6 1171.2,534.9 1171.2,465.2 1106.4,400.4 1242,264.8 1421.3,264.8 1550,136 1634.3,136 1745.6,24.7 1897.1,24.7 1918.8,46.5 2016.6,46.5 2016.6,93.9 1930.5,180.2 1930.5,133.7 1902.3,105.5 1883.7,124.1 1859.8,124.1 1859.8,85.7 1786.9,85.7 1786.9,144.5 1759.1,172.2 1759.1,222.5 1705.9,275.8 1662.7,275.8 1628.9,242 1589.6,242 1563.7,267.9 1563.7,290.9 1579.9,307.1 1579.9,340.1 1564.2,355.8 1525.7,355.8 1506.5,336.7 1477.4,365.8 1459.9,348.3 1459.9,316.4 "\n               id="colon" />\n\n            <g id="embera_wounaan">\n               <polygon\n                  points="2907.2,628.5 2720.9,442.1 2682.2,442.1 2591.7,532.5 2665.9,606.7 2665.9,654.1 2757.5,745.7 2757.5,780.6 2786.9,810 2843.8,810 2928.2,725.6 2928.2,708.4 2907.2,687.3 "\n                  id="polygon12" />\n\n               <polygon\n                  points="2526,1010.4 2478.6,1010.4 2451.1,982.8 2451.1,939.5 2400.3,888.7 2435,850.7 2457.6,850.7 2457.6,815.2 2472.9,799.9 2551.3,878.3 2569.7,860 2569.7,927.9 2600.3,958.6 2600.3,1050.3 2526,1050.3 "\n                  id="polygon13" />\n            </g>\n\n            <polygon\n               points="1459.9,316.4 1367.6,408.7 1332.1,373.2 1283.5,373.2 1283.5,442.7 1226,442.7 1199.5,469.1 1199.5,506.6 1133.5,572.7 1182.3,621.5 1182.1,758.9 1209.7,786.3 1290.1,786.3 1308.2,803.9 1308.2,750.5 1359.4,699.4 1474.1,699.4 1539.1,634.4 1510.6,605.9 1510.6,512 1477.4,478.8 1477.4,365.8 1459.9,348.3 "\n               id="cocle" />\n\n            <g id="g18">\n               <polygon\n                  points="321.6,337.1 390.6,268 390.6,338.8 464.5,412.7 508.7,368.5 477,336.8 420.6,336.8 420.6,252.2 456.9,252.2 483.5,278.7 508.9,253.3 472.7,217.1 454,235.8 398.6,180.5 383,196.1 383,225.5 360.1,225.5 331.6,197.1 356.9,171.8 337.5,152.3 368.5,121.2 348.8,121.2 268.3,40.7 226.8,82.2 210.1,82.2 155.3,27.3 104,27.3 88.7,42.7 120.8,74.8 120.8,92.3 120.8,111.8 154.7,111.8 178.1,88.4 250.1,160.3 226.7,183.8 226.7,266.1 194.8,297.9 178.5,297.9 145.1,331.3 168,354.2 168,382.6 230.5,382.6 285.3,437.5 365.7,437.5 365.7,381.2 "\n                  id="polygon16" />\n\n               <polygon points="410.7,112.9 410.7,127.7 421.6,138.7 421.6,176.2 374.3,127.7 389.2,112.9 " id="polygon17" />\n\n               <polygon points="464.4,206.5 491,179.9 473,161.9 454.9,161.9 442.8,149.8 434.5,156.4 434.5,176.6 " id="polygon18" />\n            </g>\n          </g>\n        </g>\n\n        <g id="etiquetas">\n\n           <g id="t_bocas_del_toro"><text transform="translate(317.1958,176.2173)" id="text18">Bocas</text><text\n                 transform="translate(283.7974,232.2346)" id="text19">del Toro</text></g>\n\n           <text transform="translate(204.7927,567.3508)" id="t_chiriqui">Chiriquí</text>\n           <text transform="translate(884.2051,783.0707)" id="t_veraguas">Veraguas</text>\n           <text transform="translate(1268.2111,586.649)" id="t_cocle">Coclé</text>\n           <text transform="translate(1253.1539,1082.5509)" id="t_los_santos">Los Santos</text>\n           <text transform="translate(1083.5479,936.0339)" id="t_herrera">Herrera</text>\n           <text transform="translate(1856.8473,265.6409)" id="t_panama">Panamá</text>\n           <text transform="translate(2623.676,879.104)" id="text26">Darién</text>\n           <text transform="translate(2330.8186,164.4968)" id="t_guna_yala">Guna Yala</text>\n           <text transform="translate(1598.8124,200.1)" id="t_colon">Colón</text>\n\n           <g id="t_panama_oeste"><text transform="translate(1499.1893,408.6331)" id="text29">Panamá</text><text\n                 transform="translate(1523.8444,455.2997)" id="text30">Oeste</text></g>\n\n           <g id="t_embera_wounaan"><text transform="translate(2707.0615,642.0316)" id="text34">Emberá</text><text\n                 transform="translate(2688.8779,688.6982)" id="text35">Wounaan</text></g>\n\n           <text transform="translate(553.6038,530.7012)" id="t_ngabe_bugle">Ngäbe-Buglé</text>\n\n           <g id="t_naso_tjer_di"><text transform="translate(88.854,191.6354)" id="text38">Naso</text><text\n                 transform="translate(74.6239,249.9687)" id="text39">Tjër Di</text></g>\n        </g>';

function provinceParts(selection) {
  return selection.node()?.tagName?.toLowerCase() === 'g' ? selection.selectAll('polygon, path') : selection;
}

function provinceLabel(svg, provinceId) {
  const selector = PANAMA_LABEL_SELECTORS.get(provinceId);
  return selector ? svg.select(selector) : d3.select(null);
}

function labelParts(selection) {
  return selection.node()?.tagName?.toLowerCase() === 'text' ? selection : selection.selectAll('text');
}

function labelColors(fill) {
  const color = d3.color(fill)?.rgb();
  if (!color) {
    return { fill: '#555555', stroke: 'rgba(255,255,255,0.92)' };
  }

  const toLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const luminance =
    0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);

  return luminance < 0.42
    ? { fill: '#ffffff', stroke: 'rgba(17,24,39,0.45)' }
    : { fill: '#3f3f46', stroke: 'rgba(255,255,255,0.92)' };
}

export function createPanamaMapSvg({
  fillByProvince = () => '#f2f2f2',
  titleByProvince = () => null,
} = {}) {
  const svg = d3
    .create('svg')
    .attr('viewBox', '0 0 3000 1300')
    .attr('role', 'img')
    .attr('aria-label', 'Mapa de Panamá');

  svg.html(PANAMA_MAP_MARKUP);

  svg
    .selectAll('polygon, path')
    .attr('stroke', '#a6a6a6')
    .attr('stroke-width', 1)
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .attr('vector-effect', 'non-scaling-stroke');

  const labels = svg.select('#etiquetas').attr('pointer-events', 'none');
  labels
    .selectAll('text')
    .attr('font-size', 34)
    .attr('font-weight', 500)
    .attr('font-family', 'system-ui, sans-serif')
    .style('paint-order', 'stroke');

  for (const [id, provinceName] of PANAMA_PROVINCE_NAMES) {
    const province = svg.select(`#${id}`);
    if (province.empty()) continue;

    const fill = fillByProvince(provinceName, id) ?? '#f2f2f2';
    const parts = provinceParts(province);
    const title = titleByProvince(provinceName, id);

    parts.attr('fill', fill);
    parts.selectAll('title').remove();
    if (title) {
      province.attr('aria-label', title);
      parts.attr('data-tooltip', title);
    }

    const label = provinceLabel(svg, id);
    if (!label.empty()) {
      const palette = labelColors(fill);
      labelParts(label)
        .attr('fill', palette.fill)
        .attr('stroke', palette.stroke)
        .attr('stroke-width', 6)
        .attr('stroke-linejoin', 'round');
    }
  }

  return svg.node();
}
