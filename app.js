(function () {
  const DATA_URL = "data/news.json";
  const state = { data: null, activeTab: "sebastien", activeSection: null };

  const contentEl = document.getElementById("content");
  const lastUpdatedEl = document.getElementById("last-updated");
  const tabButtons = document.querySelectorAll(".tab-btn");

  function readParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const section = params.get("section");
    if (tab) state.activeTab = tab;
    if (section) state.activeSection = section;
  }

  function syncUrl() {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", state.activeTab);
    if (state.activeSection) {
      params.set("section", state.activeSection);
    } else {
      params.delete("section");
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", newUrl);
  }

  function syncTabButtons() {
    tabButtons.forEach((b) => {
      const isActive = b.dataset.tab === state.activeTab;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      state.activeSection = null; // on repart sur la 1re section du nouvel onglet
      syncTabButtons();
      render();
    });
  });

  function timeAgo(iso) {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    return `il y a ${days} j`;
  }

  function formatLastUpdated(iso) {
    if (!iso) return "Mise à jour : inconnue";
    const d = new Date(iso);
    const formatted = d.toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `Mise à jour : ${formatted} (${timeAgo(iso)})`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function renderCard(item) {
    return `
      <article class="card">
        <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
        ${item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : ""}
        <div class="meta">
          <span>${escapeHtml(item.source || "")}</span>
          <span>${timeAgo(item.published)}</span>
        </div>
      </article>`;
  }

  function renderSection(sectionKey, section) {
    const items = (section && section.items) || [];
    const body = items.length
      ? `<div class="card-grid">${items.map(renderCard).join("")}</div>`
      : `<p class="empty">Pas encore d'articles pour cette section — la prochaine synchronisation ajoutera du contenu.</p>`;
    return `
      <section class="section">
        <h2>${escapeHtml((section && section.label) || sectionKey)}</h2>
        ${body}
      </section>`;
  }

  function render() {
    if (!state.data) return;

    // Onglet invalide (ex: ?tab=inconnu) -> on retombe sur le premier disponible.
    const tabKeys = Object.keys(state.data).filter((k) => k !== "generated_at");
    if (!tabKeys.includes(state.activeTab)) {
      state.activeTab = tabKeys[0];
    }
    syncTabButtons();

    const tabData = state.data[state.activeTab] || {};
    const sectionKeys = Object.keys(tabData);
    if (!sectionKeys.length) {
      contentEl.innerHTML = `<p class="empty">Aucune donnée disponible.</p>`;
      syncUrl();
      return;
    }

    // Section invalide ou absente -> premiere section du tab.
    if (!state.activeSection || !sectionKeys.includes(state.activeSection)) {
      state.activeSection = sectionKeys[0];
    }

    const subtabsHtml =
      sectionKeys.length > 1
        ? `<nav class="subtabs" role="tablist">${sectionKeys
            .map((k) => {
              const isActive = k === state.activeSection;
              return `<button class="subtab-btn${isActive ? " active" : ""}" data-section="${escapeHtml(
                k
              )}" role="tab" aria-selected="${isActive}">${escapeHtml(tabData[k].label || k)}</button>`;
            })
            .join("")}</nav>`
        : "";

    const activeSectionData = tabData[state.activeSection];
    contentEl.innerHTML = `${subtabsHtml}<div class="sections">${renderSection(
      state.activeSection,
      activeSectionData
    )}</div>`;

    contentEl.querySelectorAll(".subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeSection = btn.dataset.section;
        render();
      });
    });

    lastUpdatedEl.textContent = formatLastUpdated(state.data.generated_at);
    syncUrl();
  }

  async function load() {
    try {
      const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      render();
    } catch (err) {
      contentEl.innerHTML = `<p class="empty">Impossible de charger les actualités pour le moment (${escapeHtml(
        err.message
      )}). Réessaie dans quelques minutes.</p>`;
      lastUpdatedEl.textContent = "";
    }
  }

  readParamsFromUrl();
  syncTabButtons();
  load();
})();
