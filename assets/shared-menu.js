(() => {
  const MENU_LINKS = [
    { href: "index.html", label: "ホーム" },
    { href: "ranking.html", label: "ランキング" },
    { href: "theory.html", label: "超回復理論" },
    { href: "photos.html", label: "写真記録" }
  ];

  function addMenuStyle() {
    if (document.getElementById("sharedMenuStyle")) return;
    const style = document.createElement("style");
    style.id = "sharedMenuStyle";
    style.textContent = `
      .mobile-menu {
        width:min(360px,calc(100vw - 24px));
      }
      .mobile-menu .menu-utility {
        position:relative;
        min-height:28px;
        display:flex;
        align-items:center;
        justify-content:flex-end;
      }
      .mobile-menu .menu-logout-slot {
        display:flex;
        justify-content:center;
        width:100%;
        min-width:0;
      }
      .mobile-menu .menu-utility .logout-link,
      .mobile-menu .menu-utility .sample-link {
        min-height:auto;
        padding:4px 0;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border:0;
        border-radius:0;
        color:var(--muted);
        background:transparent;
        font-size:12px;
        font-weight:900;
        text-align:center;
        text-decoration:underline;
        text-underline-offset:3px;
        white-space:nowrap;
      }
      .mobile-menu .menu-utility .sample-link {
        position:absolute;
        top:50%;
        right:0;
        transform:translateY(-50%);
        font-size:11px;
        text-align:right;
      }
      .mobile-menu .menu-utility .logout-link:hover,
      .mobile-menu .menu-utility .sample-link:hover {
        color:var(--coal);
      }
    `;
    document.head.appendChild(style);
  }

  function renderMenu(menu) {
    const usesAuth = menu.dataset.menuAuth === "true";
    const quickMode = menu.dataset.menuQuick || "link";
    const utility = `
      <div class="menu-utility ${usesAuth ? "has-auth" : ""}">
        ${usesAuth ? `<span class="menu-logout-slot"><button class="logout-link hidden" type="button" id="logoutBtn">ログアウト</button></span>` : ""}
        <a class="sample-link" href="sample.html">サンプルページ</a>
      </div>
    `;
    const links = MENU_LINKS.map(item => `<a href="${item.href}">${item.label}</a>`).join("");
    const quick = quickMode === "button"
      ? `<button class="mobile-primary" type="button" id="quickAddBtn">今日の筋トレ</button>`
      : `<a class="mobile-primary" href="index.html#record">今日の筋トレ</a>`;
    menu.innerHTML = `${utility}${links}${quick}`;
  }

  addMenuStyle();
  document.querySelectorAll(".mobile-menu").forEach(renderMenu);
})();
