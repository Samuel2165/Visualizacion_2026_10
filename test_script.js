        const CONFIG = {
            files: {
                suicidios: "data/datos_suicidios_2021.csv",
                pib: "data/PIB_departamental.csv",
                poblacion: "data/poblacion_departamentos_2021.csv",
                geojson: "mapas/ADMINISTRATIVO/MGN_ADM_DPTO_POLITICO.geojson"
            },
            palette: ["#14B8A6", "#60A5FA", "#A78BFA", "#F59E0B", "#F472B6", "#34D399"],
            maxTableRows: 500
        };

        const state = {
            department: "ALL",
            municipio: "ALL",
            weekMin: 1,
            weekMax: 53,
            metric: "total",
            topN: 10,
            orderX: "natural",
            orderY: "natural",
            tableDimension: "departamento"
        };

        const els = {
            statusList: document.getElementById("statusList"),
            mappingInfo: document.getElementById("mappingInfo"),
            errorBanner: document.getElementById("errorBanner"),
            filterDept: document.getElementById("filterDept"),
            filterMun: document.getElementById("filterMun"),
            filterWeekMin: document.getElementById("filterWeekMin"),
            filterWeekMax: document.getElementById("filterWeekMax"),
            filterMetric: document.getElementById("filterMetric"),
            filterTopN: document.getElementById("filterTopN"),
            orderAxisX: document.getElementById("orderAxisX"),
            orderAxisY: document.getElementById("orderAxisY"),
            resetFilters: document.getElementById("resetFilters"),
            kpiTotal: document.getElementById("kpiTotal"),
            kpiAvg: document.getElementById("kpiAvg"),
            kpiMun: document.getElementById("kpiMun"),
            kpiMunSub: document.getElementById("kpiMunSub"),
            kpiDept: document.getElementById("kpiDept"),
            kpiDeptSub: document.getElementById("kpiDeptSub"),
            kpiRate: document.getElementById("kpiRate"),
            kpiTop5: document.getElementById("kpiTop5"),
            riskTable: document.getElementById("riskTable"),
            tableDimension: document.getElementById("tableDimension"),
            tableSearch: document.getElementById("tableSearch"),
            resetTableFilters: document.getElementById("resetTableFilters"),
            downloadTable: document.getElementById("downloadTable"),
            sourcesCards: document.getElementById("sourcesCards"),
            sourcesTable: document.getElementById("sourcesTable"),
            methodologyNotes: document.getElementById("methodologyNotes"),
            analysisSummary: document.getElementById("analysisSummary"),
            analysisTemporal: document.getElementById("analysisTemporal"),
            analysisTerritorial: document.getElementById("analysisTerritorial"),
            analysisPopulation: document.getElementById("analysisPopulation"),
            analysisPib: document.getElementById("analysisPib"),
            analysisLimits: document.getElementById("analysisLimits")
        };

        let rawSuicidios = [];
        let deptLookup = { byCode: new Map(), byName: new Map() };
        let table = null;
        let minWeek = 1;
        let maxWeek = 53;
        let mapInstance = null;
        let mapLayer = null;
        let geojsonData = null;

        const numberFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
        const numberFmt2 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

        document.querySelectorAll(".nav-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                const viewId = btn.getAttribute("data-view");
                document.querySelectorAll(".view").forEach((view) => {
                    view.classList.toggle("active", view.id === viewId);
                });
                if (viewId === "dashboard" && mapInstance) {
                    setTimeout(() => mapInstance.invalidateSize(), 200);
                }
            });
        });

        document.querySelectorAll("[data-download]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const chartId = btn.getAttribute("data-download");
                const node = document.getElementById(chartId);
                if (node) {
                    Plotly.downloadImage(node, { format: "png", filename: chartId });
                }
            });
        });

        els.filterDept.addEventListener("change", () => {
            state.department = els.filterDept.value;
            state.municipio = "ALL";
            updateMunicipioOptions();
            renderAll();
        });
        els.filterMun.addEventListener("change", () => {
            state.municipio = els.filterMun.value;
            renderAll();
        });
        els.filterWeekMin.addEventListener("change", () => {
            state.weekMin = clampWeek(parseInt(els.filterWeekMin.value, 10));
            renderAll();
        });
        els.filterWeekMax.addEventListener("change", () => {
            state.weekMax = clampWeek(parseInt(els.filterWeekMax.value, 10));
            renderAll();
        });
        els.filterMetric.addEventListener("change", () => {
            state.metric = els.filterMetric.value;
            renderAll();
        });
        els.filterTopN.addEventListener("change", () => {
            state.topN = parseInt(els.filterTopN.value, 10);
            renderAll();
        });
        els.orderAxisX.addEventListener("change", () => {
            state.orderX = els.orderAxisX.value;
            renderAll();
        });
        els.orderAxisY.addEventListener("change", () => {
            state.orderY = els.orderAxisY.value;
            renderAll();
        });
        els.resetFilters.addEventListener("click", () => {
            state.department = "ALL";
            state.municipio = "ALL";
            state.weekMin = minWeek;
            state.weekMax = maxWeek;
            state.metric = "total";
            state.topN = 10;
            state.orderX = "natural";
            state.orderY = "natural";
            syncFilterInputs();
            renderAll();
        });
        els.tableDimension.addEventListener("change", () => {
            state.tableDimension = els.tableDimension.value;
            renderAll();
        });
        els.tableSearch.addEventListener("input", (event) => {
            const value = event.target.value.trim();
            if (!table) return;
            if (!value) {
                table.clearFilter();
                return;
            }
            table.setFilter([
                [{ field: "departamento", type: "like", value }],
                [{ field: "municipio", type: "like", value }]
            ]);
        });
        els.resetTableFilters.addEventListener("click", () => {
            els.tableSearch.value = "";
            if (table) table.clearFilter();
        });
        els.downloadTable.addEventListener("click", () => {
            if (table) table.download("csv", "tabla_filtrada.csv");
        });

        function setLoading(isLoading) {
            document.body.classList.toggle("loading", isLoading);
        }

        function showError(message) {
            els.errorBanner.textContent = message;
            els.errorBanner.classList.add("active");
        }

        function clearError() {
            els.errorBanner.classList.remove("active");
            els.errorBanner.textContent = "";
        }

        function clampWeek(value) {
            if (!Number.isFinite(value)) return minWeek;
            return Math.max(minWeek, Math.min(maxWeek, value));
        }

        function normalizeKey(value) {
            return String(value || "")
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z0-9]+/g, " ")
                .trim();
        }

        function formatDeptCode(value) {
            if (value === null || value === undefined) return null;
            const num = String(parseNumber(value)).padStart(2, "0");
            return num;
        }

        function parseNumber(value) {
            if (value === null || value === undefined) return null;
            let raw = String(value).replace(/\s+/g, "").replace(/"/g, "");
            if (!raw) return null;
            if (/^\d{1,3},\d{3}$/.test(raw)) {
                return Number(raw.replace(/,/g, ""));
            }
            if (raw.includes(",") && !raw.includes(".")) {
                raw = raw.replace(/,/g, ".");
            }
            const num = Number(raw);
            return Number.isFinite(num) ? num : null;
        }

        function formatNumber(value) {
            return value === null || value === undefined ? "-" : numberFmt.format(value);
        }

        function formatRate(value) {
            return value === null || value === undefined ? "-" : numberFmt2.format(value);
        }

        function median(values) {
            if (!values.length) return null;
            const sorted = values.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 0) {
                return (sorted[mid - 1] + sorted[mid]) / 2;
            }
            return sorted[mid];
        }

        function linearRegression(points) {
            if (points.length < 2) return null;
            const n = points.length;
            const sumX = points.reduce((sum, p) => sum + p.x, 0);
            const sumY = points.reduce((sum, p) => sum + p.y, 0);
            const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
            const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
            const denom = n * sumXX - sumX * sumX;
            if (denom === 0) return null;
            const slope = (n * sumXY - sumX * sumY) / denom;
            const intercept = (sumY - slope * sumX) / n;
            return { slope, intercept };
        }

        function pickColumn(headers, candidates) {
            const normalized = headers.map((h) => normalizeKey(h));
            for (const candidate of candidates) {
                const idx = normalized.indexOf(normalizeKey(candidate));
                if (idx >= 0) return headers[idx];
            }
            return null;
        }

        function findYearColumn(headers, year) {
            const regex = new RegExp(String(year));
            const match = headers.find((h) => regex.test(h));
            return match || null;
        }

        function loadCsv(path) {
            return new Promise((resolve, reject) => {
                Papa.parse(path, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors && results.errors.length) {
                            reject(new Error(results.errors[0].message));
                            return;
                        }
                        resolve(results);
                    },
                    error: (err) => reject(err)
                });
            });
        }

        function getOrCreateDept(code, name) {
            let record = null;
            if (code !== null && code !== undefined && deptLookup.byCode.has(code)) {
                record = deptLookup.byCode.get(code);
            }
            if (!record && name) {
                const key = normalizeKey(name);
                record = deptLookup.byName.get(key);
            }
            if (!record) {
                record = { code: code ?? null, name: name || "", pib: null, pop: null, region: null, key: null };
            }
            if (code !== null && code !== undefined) {
                deptLookup.byCode.set(code, record);
            }
            if (name) {
                deptLookup.byName.set(normalizeKey(name), record);
            }
            if (!record.key) {
                record.key = code !== null && code !== undefined ? `COD_${code}` : `NAME_${normalizeKey(name)}`;
            }
            if (!record.name && name) record.name = name;
            return record;
        }

        function buildMappings(suicidiosResult, pibResult, popResult) {
            const suicHeaders = suicidiosResult.meta.fields || [];
            const pibHeaders = pibResult.meta.fields || [];
            const popHeaders = popResult.meta.fields || [];

            const mapping = {
                suicidios: {
                    municipio: pickColumn(suicHeaders, ["municipio_ocurrencia", "municipio", "mun", "mpio"]),
                    departamento: pickColumn(suicHeaders, ["departamento_ocurrencia", "departamento", "depto", "departamentos"]),
                    semana: pickColumn(suicHeaders, ["semana", "week"]),
                    anio: pickColumn(suicHeaders, ["anio", "ano", "year"]),
                    conteo: pickColumn(suicHeaders, ["conteo", "numero_intentos", "intentos", "total", "casos"]),
                    codigo_departamento: pickColumn(suicHeaders, ["codigo_departamento", "codigo_departamento_divipola", "cod_depto", "dp"])
                },
                pib: {
                    departamento: pickColumn(pibHeaders, ["departamentos", "departamento", "dpnom"]),
                    codigo: pickColumn(pibHeaders, ["codigo_departamento_divipola", "codigo_departamento", "dp"]),
                    pib: findYearColumn(pibHeaders, 2021)
                },
                poblacion: {
                    departamento: pickColumn(popHeaders, ["dpnom", "departamentos", "departamento"]),
                    codigo: pickColumn(popHeaders, ["dp", "codigo_departamento", "codigo_departamento_divipola"]),
                    region: pickColumn(popHeaders, ["region", "region_geo"]),
                    anio: pickColumn(popHeaders, ["ano", "anio", "year"]),
                    total: pickColumn(popHeaders, ["total", "poblacion", "poblacion_2021"]),
                    area: pickColumn(popHeaders, ["area_geografica", "area"])
                }
            };

            const missing = [];
            if (!mapping.suicidios.municipio) missing.push("suicidios: municipio");
            if (!mapping.suicidios.departamento) missing.push("suicidios: departamento");
            if (!mapping.suicidios.semana) missing.push("suicidios: semana");
            if (!mapping.suicidios.anio) missing.push("suicidios: anio");
            if (!mapping.suicidios.conteo) missing.push("suicidios: conteo");
            if (!mapping.pib.departamento) missing.push("pib: departamento");
            if (!mapping.pib.pib) missing.push("pib: columna 2021");
            if (!mapping.poblacion.departamento) missing.push("poblacion: departamento");
            if (!mapping.poblacion.total) missing.push("poblacion: total");

            if (missing.length) {
                throw new Error(`Faltan columnas criticas: ${missing.join(", ")}`);
            }

            return mapping;
        }

        function normalizeData(suicidiosResult, pibResult, popResult, mapping) {
            deptLookup = { byCode: new Map(), byName: new Map() };

            const pibRows = pibResult.data
                .map((row) => ({
                    code: parseNumber(row[mapping.pib.codigo]),
                    name: String(row[mapping.pib.departamento] || "").trim(),
                    pib: parseNumber(row[mapping.pib.pib])
                }))
                .filter((row) => row.name && row.pib !== null);

            pibRows.forEach((row) => {
                if (normalizeKey(row.name) === "COLOMBIA") return;
                const record = getOrCreateDept(row.code, row.name);
                record.pib = row.pib;
            });

            const popRows = popResult.data
                .map((row) => ({
                    code: parseNumber(row[mapping.poblacion.codigo]),
                    name: String(row[mapping.poblacion.departamento] || "").trim(),
                    region: String(row[mapping.poblacion.region] || "").trim(),
                    year: parseNumber(row[mapping.poblacion.anio]),
                    total: parseNumber(row[mapping.poblacion.total]),
                    area: String(row[mapping.poblacion.area] || "").trim()
                }))
                .filter((row) => row.name && row.total !== null)
                .filter((row) => !row.year || row.year === 2021)
                .filter((row) => !row.area || normalizeKey(row.area) === "TOTAL");

            popRows.forEach((row) => {
                const record = getOrCreateDept(row.code, row.name);
                record.pop = row.total;
                if (row.region) record.region = row.region;
            });

            rawSuicidios = suicidiosResult.data
                .map((row) => {
                    const departamento = String(row[mapping.suicidios.departamento] || "").trim();
                    const municipio = String(row[mapping.suicidios.municipio] || "").trim();
                    const week = parseNumber(row[mapping.suicidios.semana]);
                    const anio = parseNumber(row[mapping.suicidios.anio]);
                    const conteo = parseNumber(row[mapping.suicidios.conteo]) || 0;
                    const code = parseNumber(row[mapping.suicidios.codigo_departamento]);
                    const deptRecord = getOrCreateDept(code, departamento);
                    return {
                        municipio,
                        departamento,
                        semana: week,
                        anio,
                        conteo,
                        deptRecord
                    };
                })
                .filter((row) => row.municipio && row.departamento && row.semana && row.anio);

            minWeek = Math.min(...rawSuicidios.map((row) => row.semana));
            maxWeek = Math.max(...rawSuicidios.map((row) => row.semana));
            state.weekMin = minWeek;
            state.weekMax = maxWeek;

            const mappingText = [
                `Suicidios: ${mapping.suicidios.municipio}, ${mapping.suicidios.departamento}, ${mapping.suicidios.semana}, ${mapping.suicidios.conteo}`,
                `PIB: ${mapping.pib.departamento}, ${mapping.pib.pib}`,
                `Poblacion: ${mapping.poblacion.departamento}, ${mapping.poblacion.total}`
            ];
            els.mappingInfo.textContent = `Columnas detectadas: ${mappingText.join(" | ")}`;
        }

        function updateStatus(totalRows) {
            const now = new Date();
            els.statusList.innerHTML = `
        <div>Estado: <span>Datos listos</span></div>
        <div>Registros: <span>${formatNumber(totalRows)}</span></div>
        <div>Ultima carga: <span>${now.toLocaleString("es-CO")}</span></div>
      `;
        }

        function syncFilterInputs() {
            els.filterDept.value = state.department;
            els.filterMun.value = state.municipio;
            els.filterWeekMin.value = state.weekMin;
            els.filterWeekMax.value = state.weekMax;
            els.filterMetric.value = state.metric;
            els.filterTopN.value = String(state.topN);
            els.orderAxisX.value = state.orderX;
            els.orderAxisY.value = state.orderY;
        }

        function updateDepartmentOptions() {
            const departments = Array.from(new Set(rawSuicidios.map((row) => row.deptRecord.name || row.departamento)))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
            els.filterDept.innerHTML = `<option value="ALL">Todos</option>` +
                departments.map((name) => `<option value="${name}">${name}</option>`).join("");
        }

        function updateMunicipioOptions() {
            const rows = rawSuicidios.filter((row) => state.department === "ALL" || row.deptRecord.name === state.department);
            const municipios = Array.from(new Set(rows.map((row) => row.municipio))).filter(Boolean).sort((a, b) => a.localeCompare(b));
            els.filterMun.innerHTML = `<option value="ALL">Todos</option>` +
                municipios.map((name) => `<option value="${name}">${name}</option>`).join("");
            els.filterMun.value = state.municipio;
        }

        function filterRows() {
            return rawSuicidios.filter((row) => {
                if (state.department !== "ALL" && row.deptRecord.name !== state.department) return false;
                if (state.municipio !== "ALL" && row.municipio !== state.municipio) return false;
                if (row.semana < state.weekMin || row.semana > state.weekMax) return false;
                return true;
            });
        }

        function aggregate(rows) {
            const deptMap = new Map();
            const munMap = new Map();
            const weekMap = new Map();
            const deptWeekMap = new Map();

            rows.forEach((row) => {
                const dept = row.deptRecord;
                const deptKey = dept.key;
                const count = row.conteo || 0;

                if (!deptMap.has(deptKey)) {
                    deptMap.set(deptKey, {
                        key: deptKey,
                        name: dept.name || row.departamento,
                        code: dept.code,
                        total: 0,
                        pop: dept.pop,
                        pib: dept.pib,
                        region: dept.region
                    });
                }
                const deptEntry = deptMap.get(deptKey);
                deptEntry.total += count;

                const munKey = `${normalizeKey(row.municipio)}|${deptKey}`;
                if (!munMap.has(munKey)) {
                    munMap.set(munKey, {
                        municipio: row.municipio,
                        departamento: deptEntry.name,
                        total: 0
                    });
                }
                munMap.get(munKey).total += count;

                weekMap.set(row.semana, (weekMap.get(row.semana) || 0) + count);

                if (!deptWeekMap.has(deptKey)) {
                    deptWeekMap.set(deptKey, new Map());
                }
                const weekEntry = deptWeekMap.get(deptKey);
                weekEntry.set(row.semana, (weekEntry.get(row.semana) || 0) + count);
            });

            const deptList = Array.from(deptMap.values()).map((dept) => ({
                ...dept,
                rate: dept.pop ? (dept.total / dept.pop) * 100000 : null
            }));
            const munList = Array.from(munMap.values());
            const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

            return { deptList, munList, weekMap, weeks, deptWeekMap };
        }

        function renderKpis(agg) {
            const total = agg.deptList.reduce((sum, d) => sum + d.total, 0);
            const avgWeekly = agg.weeks.length ? total / agg.weeks.length : 0;
            const topMun = agg.munList.sort((a, b) => b.total - a.total)[0];
            const topDept = agg.deptList.sort((a, b) => b.total - a.total)[0];
            const top5 = agg.deptList.slice(0, 5).reduce((sum, d) => sum + d.total, 0);
            const popSum = agg.deptList.reduce((sum, d) => sum + (d.pop || 0), 0);
            const rateNational = popSum ? (total / popSum) * 100000 : null;

            els.kpiTotal.textContent = formatNumber(total);
            els.kpiAvg.textContent = formatRate(avgWeekly);
            els.kpiMun.textContent = topMun ? `${topMun.municipio}` : "-";
            els.kpiMunSub.textContent = topMun ? formatNumber(topMun.total) : "Sin datos";
            els.kpiDept.textContent = topDept ? `${topDept.name}` : "-";
            els.kpiDeptSub.textContent = topDept ? formatNumber(topDept.total) : "Sin datos";
            els.kpiRate.textContent = rateNational ? formatRate(rateNational) : "-";
            els.kpiTop5.textContent = total ? `${formatRate((top5 / total) * 100)}%` : "-";

            return { total, avgWeekly, topMun, topDept, rateNational, top5Share: total ? (top5 / total) * 100 : 0 };
        }

        function baseLayout(title) {
            return {
                title: { text: title, font: { size: 12, color: "#94A3B8" } },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { t: 30, l: 40, r: 20, b: 40 },
                font: { color: "#E5E7EB", family: "Manrope, sans-serif" },
                xaxis: { gridcolor: "rgba(148,163,184,0.15)", zerolinecolor: "rgba(148,163,184,0.2)" },
                yaxis: { gridcolor: "rgba(148,163,184,0.15)", zerolinecolor: "rgba(148,163,184,0.2)" }
            };
        }

        function renderTrend(agg) {
            let x = [...agg.weeks];
            let y = x.map((w) => agg.weekMap.get(w) || 0);
            if (state.orderX === "desc") {
                x = x.slice().reverse();
                y = y.slice().reverse();
            }
            let peakWeek = "-";
            let peakValue = 0;
            if (y.length) {
                peakValue = Math.max(...y);
                const peakIndex = y.indexOf(peakValue);
                peakWeek = x[peakIndex];
            }
            const peakText = peakWeek === "-"
                ? "Semana pico: -"
                : `Semana pico: ${peakWeek} (${formatNumber(peakValue)} intentos)`;
            const peakEl = document.getElementById("trendPeak");
            if (peakEl) peakEl.textContent = peakText;
            const traces = [
                {
                    x,
                    y,
                    type: "scatter",
                    mode: "lines",
                    fill: "tozeroy",
                    line: { color: CONFIG.palette[0], width: 3 },
                    hovertemplate: "Semana %{x}<br>Intentos %{y}<extra></extra>"
                }
            ];
            if (peakWeek !== "-") {
                traces.push({
                    x: [peakWeek],
                    y: [peakValue],
                    type: "scatter",
                    mode: "markers+text",
                    marker: {
                        size: 12,
                        color: "#F59E0B",
                        line: { color: "#0B1020", width: 1 }
                    },
                    text: ["Max"],
                    textposition: "top center",
                    hovertemplate: "Semana %{x}<br>Intentos %{y}<extra></extra>"
                });
            }
            const trendLayout = { ...baseLayout(""), showlegend: false };
            Plotly.react("chartTrend", traces, trendLayout, { displayModeBar: false, responsive: true });
        }

        function renderDeptRanking(agg) {
            let sorted = [...agg.deptList].sort((a, b) => {
                const valA = state.metric === "rate" ? (a.rate || 0) : a.total;
                const valB = state.metric === "rate" ? (b.rate || 0) : b.total;
                return valB - valA;
            });
            if (state.orderY === "asc") sorted = sorted.slice().reverse();
            sorted = sorted.slice(0, state.topN);
            Plotly.react("chartDeptRank", [
                {
                    x: sorted.map((d) => state.metric === "rate" ? d.rate || 0 : d.total),
                    y: sorted.map((d) => d.name),
                    type: "bar",
                    orientation: "h",
                    marker: { color: CONFIG.palette[1] },
                    hovertemplate: "%{y}<br>Valor %{x}<extra></extra>"
                }
            ], {
                ...baseLayout(""),
                margin: { t: 20, l: 120, r: 20, b: 40 }
            }, { displayModeBar: false, responsive: true });

            const chart = document.getElementById("chartDeptRank");
            chart.on("plotly_click", (event) => {
                const deptName = event.points[0].y;
                state.department = deptName;
                syncFilterInputs();
                updateMunicipioOptions();
                renderAll();
            });
        }

        function renderMunRanking(agg) {
            let sorted = [...agg.munList].sort((a, b) => b.total - a.total);
            if (state.orderY === "asc") sorted = sorted.slice().reverse();
            sorted = sorted.slice(0, state.topN);
            Plotly.react("chartMunRank", [
                {
                    x: sorted.map((d) => d.total),
                    y: sorted.map((d) => d.municipio),
                    type: "bar",
                    orientation: "h",
                    marker: { color: CONFIG.palette[2] },
                    hovertemplate: "%{y}<br>Intentos %{x}<extra></extra>"
                }
            ], {
                ...baseLayout(""),
                margin: { t: 20, l: 130, r: 20, b: 40 }
            }, { displayModeBar: false, responsive: true });
        }

        function renderHeatmap(agg) {
            let deptSorted = [...agg.deptList].sort((a, b) => b.total - a.total);
            if (state.orderY === "asc") deptSorted = deptSorted.slice().reverse();
            deptSorted = deptSorted.slice(0, state.topN);
            let weeks = [...agg.weeks];
            if (state.orderX === "desc") weeks = weeks.slice().reverse();
            const z = deptSorted.map((dept) => {
                const weekMap = agg.deptWeekMap.get(dept.key) || new Map();
                return weeks.map((w) => {
                    const total = weekMap.get(w) || 0;
                    return state.metric === "rate" && dept.pop ? (total / dept.pop) * 100000 : total;
                });
            });

            Plotly.react("chartHeatmap", [
                {
                    z,
                    x: weeks,
                    y: deptSorted.map((d) => d.name),
                    type: "heatmap",
                    colorscale: [
                        [0, "#0F172A"],
                        [0.3, "#14B8A6"],
                        [0.6, "#60A5FA"],
                        [1, "#F59E0B"]
                    ],
                    hovertemplate: "Depto %{y}<br>Semana %{x}<br>Valor %{z}<extra></extra>"
                }
            ], {
                ...baseLayout(""),
                margin: { t: 20, l: 140, r: 20, b: 40 }
            }, { displayModeBar: false, responsive: true });
        }

        function renderScatter(agg, chartId, xKey, title) {
            let points = agg.deptList
                .filter((d) => d[xKey])
                .map((d) => ({
                    name: d.name,
                    x: d[xKey],
                    y: state.metric === "rate" ? d.rate : d.total,
                    pop: d.pop,
                    pib: d.pib
                }));
            if (state.orderX === "asc") points = points.slice().sort((a, b) => a.x - b.x);
            if (state.orderX === "desc") points = points.slice().sort((a, b) => b.x - a.x);
            if (state.orderY === "asc") points = points.slice().sort((a, b) => a.y - b.y);
            if (state.orderY === "desc") points = points.slice().sort((a, b) => b.y - a.y);

            Plotly.react(chartId, [
                {
                    x: points.map((p) => p.x),
                    y: points.map((p) => p.y),
                    text: points.map((p) => p.name),
                    mode: "markers",
                    type: "scatter",
                    marker: {
                        size: 12,
                        color: CONFIG.palette[3],
                        line: { color: "#0B1020", width: 1 }
                    },
                    hovertemplate: "%{text}<br>X %{x}<br>Y %{y}<extra></extra>"
                }
            ], baseLayout(title), { displayModeBar: false, responsive: true });
        }

        function renderPibScatter(agg) {
            let points = agg.deptList
                .filter((d) => d.pib && Number.isFinite(d.total))
                .map((d) => ({
                    name: d.name,
                    x: d.total,
                    y: d.pib,
                    rate: d.rate,
                    pop: d.pop
                }));
            if (state.orderX === "asc") points = points.slice().sort((a, b) => a.x - b.x);
            if (state.orderX === "desc") points = points.slice().sort((a, b) => b.x - a.x);
            if (state.orderY === "asc") points = points.slice().sort((a, b) => a.y - b.y);
            if (state.orderY === "desc") points = points.slice().sort((a, b) => b.y - a.y);

            const xValues = points.map((p) => p.x);
            const yValues = points.map((p) => p.y);
            const xMedian = median(xValues);
            const yMedian = median(yValues);
            const regression = linearRegression(points);
            const xMin = Math.min(...xValues);
            const xMax = Math.max(...xValues);

            const traces = [
                {
                    x: xValues,
                    y: yValues,
                    text: points.map((p) => p.name),
                    mode: "markers",
                    type: "scatter",
                    marker: {
                        size: 12,
                        color: CONFIG.palette[3],
                        line: { color: "#0B1020", width: 1 }
                    },
                    hovertemplate: "%{text}<br>Casos %{x}<br>PIB %{y}<extra></extra>"
                }
            ];

            if (regression) {
                traces.push({
                    x: [xMin, xMax],
                    y: [regression.slope * xMin + regression.intercept, regression.slope * xMax + regression.intercept],
                    mode: "lines",
                    line: { color: CONFIG.palette[1], width: 2, dash: "dash" },
                    hoverinfo: "skip"
                });
            }

            Plotly.react("chartPib", traces, {
                ...baseLayout(""),
                showlegend: false,
                xaxis: { title: "Casos", gridcolor: "rgba(148,163,184,0.15)" },
                yaxis: { title: "PIB 2021", gridcolor: "rgba(148,163,184,0.15)" },
                shapes: [
                    {
                        type: "line",
                        x0: xMedian,
                        x1: xMedian,
                        y0: Math.min(...yValues),
                        y1: Math.max(...yValues),
                        line: { color: "rgba(148,163,184,0.6)", dash: "dot" }
                    },
                    {
                        type: "line",
                        x0: xMin,
                        x1: xMax,
                        y0: yMedian,
                        y1: yMedian,
                        line: { color: "rgba(148,163,184,0.6)", dash: "dot" }
                    }
                ]
            }, { displayModeBar: false, responsive: true });
        }

        function renderPopRiskScatter(agg) {
            let points = agg.deptList
                .filter((d) => d.pop && Number.isFinite(d.total))
                .map((d) => ({
                    name: d.name,
                    x: d.pop,
                    y: d.total,
                    rate: d.rate
                }));
            if (state.orderX === "asc") points = points.slice().sort((a, b) => a.x - b.x);
            if (state.orderX === "desc") points = points.slice().sort((a, b) => b.x - a.x);
            if (state.orderY === "asc") points = points.slice().sort((a, b) => a.y - b.y);
            if (state.orderY === "desc") points = points.slice().sort((a, b) => b.y - a.y);

            const xValues = points.map((p) => p.x);
            const yValues = points.map((p) => p.y);
            const xMedian = median(xValues);
            const yMedian = median(yValues);
            const xMin = Math.min(...xValues);
            const xMax = Math.max(...xValues);
            const yMin = Math.min(...yValues);
            const yMax = Math.max(...yValues);

            const shapes = [
                {
                    type: "rect",
                    x0: xMin,
                    x1: xMedian,
                    y0: yMedian,
                    y1: yMax,
                    fillcolor: "rgba(244, 114, 182, 0.18)",
                    line: { width: 0 }
                },
                {
                    type: "rect",
                    x0: xMedian,
                    x1: xMax,
                    y0: yMin,
                    y1: yMedian,
                    fillcolor: "rgba(52, 211, 153, 0.18)",
                    line: { width: 0 }
                },
                {
                    type: "rect",
                    x0: xMin,
                    x1: xMedian,
                    y0: yMin,
                    y1: yMedian,
                    fillcolor: "rgba(245, 158, 11, 0.16)",
                    line: { width: 0 }
                },
                {
                    type: "rect",
                    x0: xMedian,
                    x1: xMax,
                    y0: yMedian,
                    y1: yMax,
                    fillcolor: "rgba(245, 158, 11, 0.16)",
                    line: { width: 0 }
                },
                {
                    type: "line",
                    x0: xMedian,
                    x1: xMedian,
                    y0: yMin,
                    y1: yMax,
                    line: { color: "rgba(148,163,184,0.6)", dash: "dot" }
                },
                {
                    type: "line",
                    x0: xMin,
                    x1: xMax,
                    y0: yMedian,
                    y1: yMedian,
                    line: { color: "rgba(148,163,184,0.6)", dash: "dot" }
                }
            ];

            const annotations = [
                {
                    x: xMin + (xMedian - xMin) * 0.5,
                    y: yMedian + (yMax - yMedian) * 0.5,
                    text: "Riesgo alto",
                    showarrow: false,
                    font: { color: "#FBCFE8", size: 12 }
                },
                {
                    x: xMedian + (xMax - xMedian) * 0.5,
                    y: yMin + (yMedian - yMin) * 0.5,
                    text: "Riesgo bajo",
                    showarrow: false,
                    font: { color: "#D1FAE5", size: 12 }
                },
                {
                    x: xMin + (xMedian - xMin) * 0.5,
                    y: yMin + (yMedian - yMin) * 0.5,
                    text: "Riesgo medio",
                    showarrow: false,
                    font: { color: "#FCD34D", size: 12 }
                },
                {
                    x: xMedian + (xMax - xMedian) * 0.5,
                    y: yMedian + (yMax - yMedian) * 0.5,
                    text: "Riesgo medio",
                    showarrow: false,
                    font: { color: "#FCD34D", size: 12 }
                }
            ];

            const pointColors = points.map((p) => {
                const lowPop = p.x <= xMedian;
                const highCases = p.y > yMedian;
                if (lowPop && highCases) return "#F472B6";
                if (!lowPop && !highCases) return "#34D399";
                return "#F59E0B";
            });

            Plotly.react("chartPop", [
                {
                    x: xValues,
                    y: yValues,
                    text: points.map((p) => p.name),
                    mode: "markers",
                    type: "scatter",
                    marker: {
                        size: 12,
                        color: pointColors,
                        line: { color: "#0B1020", width: 1 }
                    },
                    hovertemplate: "%{text}<br>Poblacion %{x}<br>Casos %{y}<extra></extra>"
                }
            ], {
                ...baseLayout(""),
                xaxis: { title: "Poblacion", gridcolor: "rgba(148,163,184,0.15)" },
                yaxis: { title: "Casos (eje invertido)", gridcolor: "rgba(148,163,184,0.15)", autorange: "reversed", automargin: true },
                shapes,
                annotations
            }, { displayModeBar: false, responsive: true });
        }

        function renderGeoTable(agg) {
            let sorted = [...agg.deptList].sort((a, b) => b.total - a.total);
            if (state.orderY === "asc") sorted = sorted.slice().reverse();
            sorted = sorted.slice(0, state.topN);
            const data = sorted.map((d) => ({
                departamento: d.name,
                total: d.total,
                rate: d.rate
            }));
            Plotly.react("chartGeoTable", [
                {
                    type: "table",
                    header: {
                        values: ["Departamento", "Total", "Tasa 100k"],
                        fill: { color: "rgba(15, 23, 42, 0.92)" },
                        font: { color: "#E5E7EB" },
                        align: "left"
                    },
                    cells: {
                        values: [
                            data.map((d) => d.departamento),
                            data.map((d) => formatNumber(d.total)),
                            data.map((d) => formatRate(d.rate))
                        ],
                        fill: {
                            color: [
                                "rgba(17, 24, 39, 0.88)",
                                "rgba(30, 41, 59, 0.78)",
                                "rgba(17, 24, 39, 0.88)"
                            ]
                        },
                        font: { color: "#E5E7EB" },
                        align: "left"
                    }
                }
            ], {
                margin: { t: 10, l: 10, r: 10, b: 10 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)"
            }, { displayModeBar: false, responsive: true });
        }

        function getRegionPalette(region) {
            const key = normalizeKey(region);
            if (key.includes("CARIBE")) return { hue: 0, border: "#F43F5E" };
            if (key.includes("ANDINA")) return { hue: 210, border: "#38BDF8" };
            if (key.includes("PACIF")) return { hue: 170, border: "#34D399" };
            if (key.includes("ORINOQ")) return { hue: 110, border: "#A3E635" };
            if (key.includes("AMAZ")) return { hue: 270, border: "#C084FC" };
            if (key.includes("INSUL")) return { hue: 35, border: "#FBBF24" };
            return { hue: 200, border: "#94A3B8" };
        }

        function colorByRate(region, rate, maxRate) {
            const palette = getRegionPalette(region);
            const norm = maxRate ? Math.min(rate / maxRate, 1) : 0;
            const saturation = 35 + norm * 55;
            const lightness = 35 + (1 - norm) * 22;
            return `hsl(${palette.hue}, ${saturation}%, ${lightness}%)`;
        }

        function initMap() {
            if (mapInstance) return;
            mapInstance = L.map("mapDept", { zoomControl: false, preferCanvas: true });
            mapInstance.setView([4.5, -74], 5);
            L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
                attribution: "&copy; OpenStreetMap &copy; CARTO",
                maxZoom: 10,
                minZoom: 4
            }).addTo(mapInstance);
            L.control.zoom({ position: "bottomright" }).addTo(mapInstance);
        }

        function renderMap(agg) {
            if (!geojsonData) return;
            initMap();

            const rateByCode = new Map();
            const rateByName = new Map();
            const regionByName = new Map();
            const regionByCode = new Map();
            const rates = [];

            agg.deptList.forEach((dept) => {
                const rate = dept.rate || 0;
                rates.push(rate);
                const code = formatDeptCode(dept.code);
                if (code) rateByCode.set(code, rate);
                if (dept.name) {
                    rateByName.set(normalizeKey(dept.name), rate);
                    if (dept.region) regionByName.set(normalizeKey(dept.name), dept.region);
                }
                if (code && dept.region) regionByCode.set(code, dept.region);
            });

            const maxRate = Math.max(...rates, 0);

            if (mapLayer) {
                mapLayer.remove();
            }

            mapLayer = L.geoJSON(geojsonData, {
                style: (feature) => {
                    const props = feature.properties || {};
                    const code = props.dpto_ccdgo;
                    const name = props.dpto_cnmbr;
                    const rate = rateByCode.get(code) ?? rateByName.get(normalizeKey(name)) ?? 0;
                    const region = regionByCode.get(code) || regionByName.get(normalizeKey(name)) || "";
                    const palette = getRegionPalette(region);
                    return {
                        color: palette.border,
                        weight: 2.6,
                        opacity: 0.9,
                        fillColor: colorByRate(region, rate, maxRate),
                        fillOpacity: 0.75
                    };
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    const name = props.dpto_cnmbr || "Departamento";
                    const code = props.dpto_ccdgo;
                    const rate = rateByCode.get(code) ?? rateByName.get(normalizeKey(name)) ?? 0;
                    const region = regionByCode.get(code) || regionByName.get(normalizeKey(name)) || "Sin region";
                    layer.bindTooltip(
                        `<strong>${name}</strong><br>Region: ${region}<br>Tasa 100k: ${formatRate(rate)}`,
                        { sticky: true }
                    );
                }
            }).addTo(mapInstance);

            const mapStatus = document.getElementById("mapStatus");
            if (mapStatus) mapStatus.textContent = "";

            const regionRates = new Map();
            agg.deptList.forEach((dept) => {
                if (!dept.region || dept.rate === null) return;
                const key = dept.region;
                if (!regionRates.has(key)) regionRates.set(key, []);
                regionRates.get(key).push(dept.rate);
            });

            const regionMedians = Array.from(regionRates.entries())
                .map(([region, values]) => ({ region, median: median(values) }))
                .sort((a, b) => a.region.localeCompare(b.region));

            if (!mapInstance._legendControl) {
                mapInstance._legendControl = L.control({ position: "topright" });
                mapInstance._legendControl.onAdd = () => {
                    const div = L.DomUtil.create("div", "map-legend");
                    div.innerHTML = "<strong>Regiones y mediana (tasa 100k)</strong>";
                    return div;
                };
                mapInstance._legendControl.addTo(mapInstance);
            }

            const legendDiv = mapInstance._legendControl.getContainer();
            legendDiv.innerHTML = "<strong>Regiones y mediana (tasa 100k)</strong>" +
                regionMedians.map((item) => {
                    const palette = getRegionPalette(item.region);
                    const swatch = `style=\"background:${palette.border}\"`;
                    return `
            <div class=\"legend-row\">
              <span><span class=\"swatch\" ${swatch}></span>${item.region}</span>
              <span>${formatRate(item.median)}</span>
            </div>
          `;
                }).join("");

            mapInstance.fitBounds(mapLayer.getBounds(), { padding: [12, 12] });
            setTimeout(() => mapInstance.invalidateSize(), 200);
        }

        function renderRiskTable(agg) {
            const points = agg.deptList
                .filter((d) => d.pop && Number.isFinite(d.total))
                .map((d) => ({ name: d.name, pop: d.pop, cases: d.total }));
            if (!points.length) {
                els.riskTable.innerHTML = "<div class=\"notice\">No hay datos suficientes para clasificar riesgo.</div>";
                return;
            }
            const popMedian = median(points.map((p) => p.pop));
            const casesMedian = median(points.map((p) => p.cases));
            const high = [];
            const low = [];
            const medium = [];

            points.forEach((p) => {
                const lowPop = p.pop <= popMedian;
                const highCases = p.cases > casesMedian;
                if (lowPop && highCases) {
                    high.push(p.name);
                } else if (!lowPop && !highCases) {
                    low.push(p.name);
                } else {
                    medium.push(p.name);
                }
            });

            els.riskTable.innerHTML = `
        <table class="meta-table">
          <thead>
            <tr>
              <th>Riesgo alto</th>
              <th>Riesgo medio</th>
              <th>Riesgo bajo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${high.sort((a, b) => a.localeCompare(b)).join(", ") || "-"}</td>
              <td>${medium.sort((a, b) => a.localeCompare(b)).join(", ") || "-"}</td>
              <td>${low.sort((a, b) => a.localeCompare(b)).join(", ") || "-"}</td>
            </tr>
          </tbody>
        </table>
      `;
        }

        function renderTable(agg) {
            let rows = [];
            if (state.tableDimension === "departamento") {
                rows = agg.deptList.map((d) => ({
                    departamento: d.name,
                    municipio: "-",
                    total: d.total,
                    rate: d.rate,
                    poblacion: d.pop,
                    pib: d.pib
                }));
            } else {
                rows = agg.munList.map((m) => ({
                    departamento: m.departamento,
                    municipio: m.municipio,
                    total: m.total,
                    rate: null,
                    poblacion: null,
                    pib: null
                }));
            }
            rows.sort((a, b) => b.total - a.total);
            rows = rows.slice(0, CONFIG.maxTableRows);

            const columns = [
                { title: "Departamento", field: "departamento", headerFilter: false },
                { title: "Municipio", field: "municipio", headerFilter: false },
                { title: "Total", field: "total", formatter: (cell) => formatNumber(cell.getValue()) },
                { title: "Tasa 100k", field: "rate", formatter: (cell) => formatRate(cell.getValue()) },
                { title: "Poblacion", field: "poblacion", formatter: (cell) => formatNumber(cell.getValue()) },
                { title: "PIB 2021", field: "pib", formatter: (cell) => formatNumber(cell.getValue()) }
            ];

            if (!table) {
                table = new Tabulator("#detailTable", {
                    data: rows,
                    columns,
                    layout: "fitColumns",
                    pagination: "local",
                    paginationSize: 12,
                    selectable: false
                });
            } else {
                table.setColumns(columns);
                table.replaceData(rows);
            }
        }

        function renderAnalysis(metrics, agg) {
            const deptTop = metrics.topDept ? metrics.topDept.name : "-";
            const munTop = metrics.topMun ? metrics.topMun.municipio : "-";
            
            const rateText = metrics.rateNational 
                ? `Esto representa una tasa de <strong>${formatRate(metrics.rateNational)} casos por cada 100k habitantes</strong> en los territorios y periodo seleccionados.` 
                : "No hay datos de tasa per cápita disponibles para esta selección.";

            els.analysisSummary.innerHTML = `
                <h3>1. Panorama General y Carga Absoluta</h3>
                <p>Durante el periodo y territorios seleccionados, se registraron un total de <strong>${formatNumber(metrics.total)} intentos de suicidio</strong>, manteniendo una media de <strong>${formatRate(metrics.avgWeekly)} casos semanales</strong>. El territorio con mayor afectación absoluta es el municipio de <strong>${munTop}</strong> en el departamento de <strong>${deptTop}</strong>. ${rateText}</p>
                <div class="analysis-insight-tag">Insight clave: El volumen absoluto ayuda a dimensionar la demanda de recursos clínicos locales directos, pero requiere normalizarse para entender la severidad territorial.</div>
            `;
            
            els.analysisTemporal.innerHTML = `
                <h3>2. Dinámica Temporal y Picos Epidemiológicos</h3>
                <p>El análisis temporal (semanas ${state.weekMin} a ${state.weekMax}) muestra oscilaciones marcadas. A nivel país, el reporte consolidado identifica que la segunda mitad del año concentra los mayores picos, especialmente en las semanas epidemiológicas <strong>37, 39 y 44</strong>, donde se concentran tasas del ~2.3% anual por semana. En el filtro activo, la media semanal se sitúa en <strong>${formatRate(metrics.avgWeekly)} intentos</strong>.</p>
                <div class="analysis-insight-tag">Insight clave: La consistencia de picos en ciertas semanas sugiere factores contextuales compartidos (por ejemplo, dinámicas escolares, cierres de ciclos, o variables climáticas/festividades) que ameritan planes de contingencia estacionales.</div>
            `;
            
            els.analysisTerritorial.innerHTML = `
                <h3>3. Concentración y Disparidad Geográfica</h3>
                <p>Se evidencia una fuerte disparidad territorial: el top 5 de departamentos con mayor incidencia acumula el <strong>${formatRate(metrics.top5Share)}%</strong> de la carga total filtrada. Esto demuestra que el fenómeno se concentra geográficamente en nodos específicos del territorio nacional.</p>
                <div class="analysis-insight-tag">Insight clave: Una proporción tan alta concentrada en 5 departamentos sugiere que las políticas de prevención nacional deben focalizarse intensivamente en estos epicentros geográficos para lograr el mayor impacto relativo.</div>
            `;
            
            els.analysisPopulation.innerHTML = `
                <h3>4. Ajuste Poblacional (Tasa por 100k)</h3>
                <p>Al normalizar los datos con la población disponible, el ranking cambia drásticamente. Departamentos con menor población absoluta pero alta vulnerabilidad relativa (como Vaupés, Putumayo o departamentos del Eje Cafetero) exhiben tasas de riesgo por 100k habitantes muy elevadas. En los datos globales del proyecto, Vaupés lidera con tasas críticas, lo que expone una realidad invisible al mirar solo volúmenes absolutos.</p>
                <div class="analysis-insight-tag">Insight clave: La "Paradoja de Carga" muestra que los territorios con menos infraestructura sanitaria suelen ser los que enfrentan la mayor tasa relativa de intentos, complicando la respuesta de salud pública.</div>
            `;
            
            els.analysisPib.innerHTML = `
                <h3>5. Correlación de Vulnerabilidad Socioeconómica (PIB)</h3>
                <p>La dispersión de los departamentos y municipios analizados revela patrones socioeconómicos interesantes al cruzarse con el Producto Interno Bruto (PIB). Existe un cuadrante crítico de departamentos con bajo PIB y alta tasa de intentos per cápita. Esto sugiere que las presiones de desarrollo económico regional y la escasez de oportunidades correlacionan positivamente con tasas de intentos de suicidio más agudas.</p>
                <div class="analysis-insight-tag">Insight clave: La salud mental en Colombia está estrechamente ligada al desarrollo territorial; los departamentos periféricos con bajo PIB requieren intervenciones que trasciendan lo puramente médico e integren bienestar económico y social.</div>
            `;
            
            els.analysisLimits.innerHTML = `
                <h3>6. Limitaciones Metodológicas de los Datos</h3>
                <p>Es importante señalar que los datos de intentos de suicidio provienen del reporte oficial municipal y semanal de 2021, mientras que el PIB y la población corresponden a agregados departamentales del DANE. Esta asimetría en la granularidad espacial exige una interpretación cuidadosa y prohíbe realizar inferencias de causalidad directas o a nivel micro-social.</p>
                <div class="analysis-insight-tag bg-warning-light">Nota de cautela: El subregistro epidemiológico y las diferencias en las capacidades de notificación de los municipios rurales frente a los urbanos pueden sesgar las tasas reportadas en favor de capitales mejor conectadas.</div>
            `;
        }

        function renderSources(mapping) {
            const sources = [
                {
                    nombre: "Intentos de suicidio",
                    archivo: CONFIG.files.suicidios,
                    descripcion: "Registro de intentos por municipio y semana en 2021.",
                    cobertura: "Colombia",
                    temporal: "2021",
                    granularidad: "Municipio - Semana",
                    variables: Object.values(mapping.suicidios).filter(Boolean).join(", "),
                    transformaciones: "Normalizacion de columnas, conversion numerica, agregacion.",
                    observaciones: "Se usan conteos reportados."
                },
                {
                    nombre: "PIB departamental",
                    archivo: CONFIG.files.pib,
                    descripcion: "PIB por departamento con serie historica; se usa columna 2021.",
                    cobertura: "Colombia",
                    temporal: "2021",
                    granularidad: "Departamento",
                    variables: Object.values(mapping.pib).filter(Boolean).join(", "),
                    transformaciones: "Seleccion de 2021 y conversion decimal.",
                    observaciones: "Se excluye fila nacional."
                },
                {
                    nombre: "Poblacion departamental",
                    archivo: CONFIG.files.poblacion,
                    descripcion: "Poblacion total departamental en 2021.",
                    cobertura: "Colombia",
                    temporal: "2021",
                    granularidad: "Departamento",
                    variables: Object.values(mapping.poblacion).filter(Boolean).join(", "),
                    transformaciones: "Filtrado a Total y anio 2021.",
                    observaciones: "Se usa para tasas por 100k."
                }
            ];

            els.sourcesCards.innerHTML = sources.map((s) => `
        <div class="source-card">
          <h3>${s.nombre}</h3>
          <p><strong>Archivo:</strong> ${s.archivo}</p>
          <p><strong>Descripcion:</strong> ${s.descripcion}</p>
          <p><strong>Granularidad:</strong> ${s.granularidad}</p>
          <p><strong>Variables:</strong> ${s.variables}</p>
        </div>
      `).join("");

            els.sourcesTable.innerHTML = `
        <thead>
          <tr>
            <th>Fuente</th>
            <th>Archivo</th>
            <th>Descripcion</th>
            <th>Cobertura geografica</th>
            <th>Cobertura temporal</th>
            <th>Granularidad</th>
            <th>Variables principales</th>
            <th>Transformaciones aplicadas</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${sources.map((s) => `
            <tr>
              <td>${s.nombre}</td>
              <td>${s.archivo}</td>
              <td>${s.descripcion}</td>
              <td>${s.cobertura}</td>
              <td>${s.temporal}</td>
              <td>${s.granularidad}</td>
              <td>${s.variables}</td>
              <td>${s.transformaciones}</td>
              <td>${s.observaciones}</td>
            </tr>
          `).join("")}
        </tbody>
      `;

            els.methodologyNotes.textContent =
                "Los tres CSV se relacionan por departamento. Los intentos se agregan desde municipio-semana a departamento-semana, " +
                "y luego se cruzan con PIB y poblacion departamental. Se calculan tasas por 100k y participaciones. " +
                "Las diferencias de granularidad limitan inferencias causales y exigen lectura prudente.";
        }

        function renderAll() {
            clearError();
            const filtered = filterRows();
            const agg = aggregate(filtered);
            const metrics = renderKpis(agg);
            renderTrend(agg);
            renderDeptRanking(agg);
            renderMunRanking(agg);
            renderHeatmap(agg);
            renderPibScatter(agg);
            renderPopRiskScatter(agg);
            renderMap(agg);
            renderGeoTable(agg);
            renderRiskTable(agg);
            renderTable(agg);
            renderAnalysis(metrics, agg);
        }

        async function init() {
            setLoading(true);
            try {
                const [suicidiosResult, pibResult, popResult, geojson] = await Promise.all([
                    loadCsv(CONFIG.files.suicidios),
                    loadCsv(CONFIG.files.pib),
                    loadCsv(CONFIG.files.poblacion),
                    fetch(CONFIG.files.geojson).then((res) => res.json())
                ]);
                const mapping = buildMappings(suicidiosResult, pibResult, popResult);
                normalizeData(suicidiosResult, pibResult, popResult, mapping);
