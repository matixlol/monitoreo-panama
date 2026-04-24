const amountOf = (d) => d.ingresoTotal ?? d.total ?? 0;
const candidateGroupOf = (d) => d.group || d.position || 'Sin grupo';
const donorGroupOf = (d) => d.position || 'Sin cargo';

const candidateLabelAccessor = (d) => d.name;
const candidateColorOf = (d) => candidateGroupOf(d);
const donorColorOf = (d) => d.party || 'Sin partido';

export const getBeeswarmLayoutOptions = (kind, extra = {}) => {
  const isCandidate = kind === 'candidato';

  return {
    width: 1000,
    height: isCandidate ? 400 : 340,
    margin: isCandidate
      ? { left: 24, bottom: 50, top: 50, right: 32 }
      : { left: 140, bottom: 50, top: 20, right: 40 },
    x: amountOf,
    r: amountOf,
    y: isCandidate ? candidateGroupOf : donorGroupOf,
    color: isCandidate ? candidateColorOf : donorColorOf,
    showYAxis: !isCandidate,
    yAxisTickPadding: isCandidate ? 20 : 100,
    yPaddingBottom: isCandidate ? 10 : 0,
    alphaMin: isCandidate ? 0.004 : 0.0001,
    rRange: isCandidate ? [1, 50] : [1, 10],
    xTickCount: 5,
    labels: isCandidate,
    labelMinR: 20,
    labelAccessor: candidateLabelAccessor,
    labelColor: 'white',
    labelFontSize: 11,
    ...extra,
  };
};
