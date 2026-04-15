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
    height: isCandidate ? 400 : 600,
    margin: isCandidate
      ? { left: 350, bottom: 50, top: 50, right: 100 }
      : { left: 250, bottom: 50, top: 20, right: 40 },
    x: amountOf,
    r: amountOf,
    y: isCandidate ? candidateGroupOf : donorGroupOf,
    color: isCandidate ? candidateColorOf : donorColorOf,
    yAxisTickPadding: isCandidate ? 20 : 100,
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
