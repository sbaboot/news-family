(function () {
  const DATA_URL = "data/news.json";
  const state = { data: null, activeTab: "noemie" };

  const contentEl = document.getElementById("content");
  const lastUpdatedEl = document.getElementById("last-updated");
  const tabButtons = document.querySelectorAll(".tab-btn");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.dataset.tab;
      tabButtons.forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
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
    const tabData = state.data[state.activeTab] || {};
    const keys = Object.keys(tabData);
    if (!keys.length) {
      contentEl.innerHTML = `<p class="empty">Aucune donnée disponible.</p>`;
      return;
    }
    contentEl.innerHTML = `<div class="sections">${keys
      .map((k) => renderSection(k, tabData[k]))
      .join("")}</div>`;
    lastUpdatedEl.textContent = formatLastUpdated(state.data.generated_at);
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

  load();
})();
