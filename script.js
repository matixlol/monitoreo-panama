import ingressData from "./ingress.json";
import egressData from "./egress.json";
console.log(ingressData);
console.log(egressData);

function createTable(data, containerId) {
  const container = document.getElementById(containerId);
  if (!data || data.length === 0) {
    container.innerHTML = "<p>No data available</p>";
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  // Create header row
  const headerRow = document.createElement("tr");
  Object.keys(data[0]).forEach((key) => {
    const th = document.createElement("th");
    th.textContent = key;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Create data rows
  data.forEach((item) => {
    const row = document.createElement("tr");
    Object.values(item).forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value === null ? "" : value;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

createTable(ingressData, "ingress-table");
createTable(egressData, "egress-table");
