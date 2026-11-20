'use strict';
/**
 * graficos.js — gráficos em SVG feitos à mão (sem biblioteca).
 *   Graficos.linha(caixa, opcoes)  → evolução de um objetivo (0–100%), até 2 séries + linhas de meta e linha de base.
 *   Graficos.barras(caixa, opcoes) → um comportamento por data (uma série) + linha de base opcional.
 *   Graficos.barrasH(caixa, opcoes) → barras horizontais por categoria (área, paciente, status) — Dashboard.
 *   Graficos.sparkline(valores)    → mini linha (string SVG) para tabelas e relatório.
 * Cores vêm das variáveis --serie-1 / --serie-2 (clinica.css), validadas para tema claro e escuro.
 * Texto sempre na cor de texto; a cor da série fica só na linha/barra (e no quadradinho da legenda).
 */

const Graficos = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const dataCurta = (iso) => { const m = String(iso).match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${m[2]}/${m[1]}` : iso; };
  const fmtPct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

  /** Rótulos do eixo X sem encavalar: no máximo ~1 a cada 56 px. */
  function indicesRotulos(n, largura) {
    const max = Math.max(2, Math.floor(largura / 56));
    if (n <= max) return Array.from({ length: n }, (_, i) => i);
    const passo = Math.ceil((n - 1) / (max - 1));
    const out = [];
    for (let i = 0; i < n; i += passo) out.push(i);
    if (out[out.length - 1] !== n - 1) {
      if (n - 1 - out[out.length - 1] < passo / 2) out.pop();
      out.push(n - 1);
    }
    return out;
  }

  /** Escala "bonita" para valores ≥ 0. */
  function escalaBonita(max, inteiro) {
    if (!(max > 0)) return inteiro ? { topo: 4, passo: 1 } : { topo: 1, passo: 0.25 };
    const bruto = max / 4, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = (inteiro ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]).map((m) => m * pot).filter((p) => !inteiro || p >= 1).find((p) => p >= bruto) || 1;
    return { topo: Math.ceil(max / passo) * passo, passo };
  }

  function legendaHtml(series) {
    if (series.length < 2) return '';
    return `<div class="graf-legenda">${series.map((s) => `<span><i class="graf-cor ${s.cor}"></i>${esc(s.nome)}</span>`).join('')}</div>`;
  }

  function tabelaHtml(colunas, linhas) {
    return `<div class="tabela-rolagem"><table class="tabela graf-tabela"><thead><tr>${colunas.map((c, i) => `<th${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map((l) => `<tr>${l.map((v, i) => `<td${i ? ' class="num"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /** Monta caixa + legenda + área do SVG + dica + botão de tabela; redesenha ao mudar a largura. */
  function montar(caixa, { titulo, legenda, desenhar, tabela, vazio }) {
    if (!caixa) return;
    if (vazio) { caixa.innerHTML = `<p class="vazio">${esc(vazio)}</p>`; return; }
    caixa.innerHTML = `
      <div class="graf-topo">${titulo ? `<span class="graf-titulo">${esc(titulo)}</span>` : ''}${legenda}
        <button class="botao botao-secundario botao-pequeno graf-btn-tabela" type="button" aria-expanded="false">Ver tabela</button></div>
      <div class="graf-area"><div class="graf-dica" hidden></div></div>
      <div class="graf-tabela-caixa" hidden>${tabela}</div>`;
    const area = caixa.querySelector('.graf-area');
    const botao = caixa.querySelector('.graf-btn-tabela');
    botao.addEventListener('click', () => {
      const t = caixa.querySelector('.graf-tabela-caixa');
      t.hidden = !t.hidden;
      botao.textContent = t.hidden ? 'Ver tabela' : 'Ocultar tabela';
      botao.setAttribute('aria-expanded', String(!t.hidden));
    });
    let ultima = 0;
    const render = () => {
      const w = Math.round(area.clientWidth);
      if (!w || w === ultima) return;
      ultima = w;
      const velho = area.querySelector('svg');
      if (velho) velho.remove();
      area.insertBefore(desenhar(w, area), area.firstChild);
    };
    render();
    if (window.ResizeObserver) new ResizeObserver(render).observe(area);
  }

  function svg(w, h, rotulo) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.setAttribute('width', w); s.setAttribute('height', h);
    s.setAttribute('role', 'img'); s.setAttribute('aria-label', rotulo);
    s.classList.add('graf-svg');
    return s;
  }
  function add(pai, tag, attrs, texto) {
    const n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    if (texto != null) n.textContent = texto;
    pai.appendChild(n);
    return n;
  }

  /** Dica flutuante (HTML) presa dentro da área do gráfico. */
  function mostrarDica(area, x, y, html) {
    const d = area.querySelector('.graf-dica');
    d.innerHTML = html; d.hidden = false;
    const w = d.offsetWidth, aw = area.clientWidth;
    let left = x + 12;
    if (left + w > aw - 4) left = x - w - 12;
    d.style.left = `${Math.max(4, left)}px`;
    d.style.top = `${Math.max(0, y - d.offsetHeight - 8)}px`;
  }
  function esconderDica(area) { const d = area.querySelector('.graf-dica'); if (d) d.hidden = true; }

  /**
   * Linha 0–100%. opcoes: { titulo, pontos:[{data, ...valores}], series:[{chave, nome, cor:'s1'|'s2'}],
   *   referencias:[{valor, rotulo, tipo:'meta'|'base'}], extraDica:(p)=>html }
   */
  function linha(caixa, opcoes) {
    const pontos = opcoes.pontos || [];
    const series = opcoes.series || [];
    const rx = opcoes.rotuloX || dataCurta, rd = opcoes.rotuloData || dataBr;
    const refs = (opcoes.referencias || []).filter((r) => r.valor != null && r.valor !== '');
    montar(caixa, {
      titulo: opcoes.titulo,
      vazio: pontos.length ? '' : (opcoes.vazio || 'Sem tentativas registradas neste período.'),
      legenda: legendaHtml(series),
      tabela: tabelaHtml(['Data'].concat(series.map((s) => s.nome)).concat(['Tentativas válidas']),
        pontos.map((p) => [rd(p.data)].concat(series.map((s) => fmtPct(p[s.chave]))).concat([String(p.validas != null ? p.validas : '')]))),
      desenhar(w, area) {
        const h = w < 480 ? 230 : 280;
        const m = { t: 14, r: w < 480 ? 64 : 92, b: 28, l: 40 };
        const pw = w - m.l - m.r, ph = h - m.t - m.b;
        const n = pontos.length;
        const X = (i) => m.l + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
        const Y = (v) => m.t + ph - v * ph;
        const s = svg(w, h, `${opcoes.titulo || 'Evolução'}: ${n} sessões`);

        [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
          add(s, 'line', { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === 0 ? 'graf-base' : 'graf-grade' });
          add(s, 'text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'graf-eixo' }, `${v * 100}%`);
        });
        indicesRotulos(n, pw).forEach((i) => add(s, 'text', { x: X(i), y: h - 8, 'text-anchor': n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', class: 'graf-eixo' }, rx(pontos[i].data)));

        refs.forEach((r) => {
          const y = Y(Math.max(0, Math.min(1, r.valor)));
          add(s, 'line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: r.tipo === 'meta' ? 'graf-ref-meta' : 'graf-ref-base' });
          add(s, 'text', { x: m.l + 4, y: y - 5, class: 'graf-ref-rotulo' }, `${r.rotulo} ${fmtPct(r.valor)}`);
        });

        // Linhas e marcadores (anel na cor da superfície para separar pontos sobrepostos)
        series.forEach((se) => {
          const seg = [];
          let atual = [];
          pontos.forEach((p, i) => { if (p[se.chave] == null) { if (atual.length) seg.push(atual); atual = []; } else atual.push([X(i), Y(p[se.chave])]); });
          if (atual.length) seg.push(atual);
          seg.forEach((pts) => add(s, 'polyline', { points: pts.map((q) => q.join(',')).join(' '), class: `graf-linha ${se.cor}` }));
          pontos.forEach((p, i) => { if (p[se.chave] != null) add(s, 'circle', { cx: X(i), cy: Y(p[se.chave]), r: 4, class: `graf-ponto ${se.cor}` }); });
        });

        // Rótulos diretos no fim de cada linha (afasta se ficarem colados)
        const finais = series.map((se) => {
          for (let i = n - 1; i >= 0; i--) if (pontos[i][se.chave] != null) return { se, y: Y(pontos[i][se.chave]), v: pontos[i][se.chave], x: X(i) };
          return null;
        }).filter(Boolean).sort((a, b) => a.y - b.y);
        for (let i = 1; i < finais.length; i++) if (finais[i].y - finais[i - 1].y < 15) finais[i].y = finais[i - 1].y + 15;
        finais.forEach((f) => {
          const curto = w < 480 ? '' : ` ${f.se.curto || ''}`;
          add(s, 'text', { x: m.l + pw + 8, y: f.y + 4, class: 'graf-rotulo-direto' }, `${fmtPct(f.v)}${curto}`);
        });

        // Camada de interação: linha-guia + dica
        const guia = add(s, 'line', { x1: 0, x2: 0, y1: m.t, y2: m.t + ph, class: 'graf-guia', visibility: 'hidden' });
        const alvo = add(s, 'rect', { x: m.l - 10, y: 0, width: pw + 20, height: h, fill: 'transparent' });
        const mover = (ev) => {
          const r = s.getBoundingClientRect();
          const px = ev.clientX - r.left;
          const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / pw) * (n - 1))));
          const p = pontos[i];
          guia.setAttribute('x1', X(i)); guia.setAttribute('x2', X(i)); guia.setAttribute('visibility', 'visible');
          const linhas = series.map((se) => `<div><i class="graf-cor ${se.cor}"></i>${esc(se.nome)} <strong>${fmtPct(p[se.chave])}</strong></div>`).join('');
          mostrarDica(area, X(i), Math.min(...series.map((se) => (p[se.chave] == null ? h : Y(p[se.chave])))), `<b>${rd(p.data)}</b>${linhas}${opcoes.extraDica ? opcoes.extraDica(p) : ''}`);
        };
        alvo.addEventListener('pointermove', mover);
        alvo.addEventListener('pointerdown', mover);
        alvo.addEventListener('pointerleave', () => { guia.setAttribute('visibility', 'hidden'); esconderDica(area); });
        return s;
      },
    });
  }

  /**
   * Barras (uma série). opcoes: { titulo, pontos:[{data, valor}], nome, unidade, referencia:{valor, rotulo}, casas,
   *   rotuloX/rotuloData (formatam o eixo e a dica), inteiro (escala só com inteiros), minTopo, extraDica, vazio }
   */
  function barras(caixa, opcoes) {
    const pontos = (opcoes.pontos || []).filter((p) => p.valor != null);
    const fmt = (v) => (v == null ? '—' : `${num2(v).replace(/,00$/, '')}${opcoes.unidade ? ' ' + opcoes.unidade : ''}`);
    const rx = opcoes.rotuloX || dataCurta, rd = opcoes.rotuloData || dataBr;
    const ref = opcoes.referencia && opcoes.referencia.valor != null && opcoes.referencia.valor !== '' ? opcoes.referencia : null;
    montar(caixa, {
      titulo: opcoes.titulo,
      vazio: pontos.length ? '' : (opcoes.vazio || 'Sem registros deste comportamento no período.'),
      legenda: '',
      tabela: tabelaHtml(['Data', opcoes.nome], pontos.map((p) => [rd(p.data), fmt(p.valor)])),
      desenhar(w, area) {
        const h = w < 480 ? 210 : 250;
        const m = { t: 14, r: 12, b: 28, l: 44 };
        const pw = w - m.l - m.r, ph = h - m.t - m.b;
        const n = pontos.length;
        const max = Math.max(...pontos.map((p) => p.valor), ref ? Number(ref.valor) : 0);
        const esc2 = escalaBonita(Math.max(max * 1.08, opcoes.minTopo || 0), opcoes.inteiro);
        const Y = (v) => m.t + ph - (v / esc2.topo) * ph;
        const banda = pw / n, larg = Math.max(3, Math.min(36, banda - 2));
        const X = (i) => m.l + banda * i + banda / 2;
        const s = svg(w, h, `${opcoes.titulo || opcoes.nome}: ${n} registros`);
        for (let v = 0; v <= esc2.topo + 1e-9; v += esc2.passo) {
          add(s, 'line', { x1: m.l, x2: m.l + pw, y1: Y(v), y2: Y(v), class: v === 0 ? 'graf-base' : 'graf-grade' });
          add(s, 'text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end', class: 'graf-eixo' }, num2(v).replace(/,00$/, ''));
        }
        indicesRotulos(n, pw).forEach((i) => add(s, 'text', { x: X(i), y: h - 8, 'text-anchor': 'middle', class: 'graf-eixo' }, rx(pontos[i].data)));
        pontos.forEach((p, i) => {
          const x = X(i) - larg / 2, y = Y(p.valor), alt = Math.max(0, Y(0) - y), r = Math.min(4, larg / 2, alt);
          // Topo arredondado (4 px), base reta no eixo
          const d = alt <= 0 ? '' : `M${x},${Y(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + larg - r} Q${x + larg},${y} ${x + larg},${y + r} V${Y(0)} Z`;
          if (d) add(s, 'path', { d, class: 'graf-barra s1' });
        });
        if (ref) {
          const y = Y(Number(ref.valor));
          add(s, 'line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, class: 'graf-ref-base' });
          add(s, 'text', { x: m.l + pw - 4, y: y - 5, 'text-anchor': 'end', class: 'graf-ref-rotulo' }, `${ref.rotulo} ${fmt(ref.valor)}`);
        }
        const destaque = add(s, 'rect', { x: 0, y: m.t, width: banda, height: ph, class: 'graf-destaque', visibility: 'hidden' });
        const alvo = add(s, 'rect', { x: m.l, y: 0, width: pw, height: h, fill: 'transparent' });
        const mover = (ev) => {
          const r = s.getBoundingClientRect();
          const i = Math.max(0, Math.min(n - 1, Math.floor((ev.clientX - r.left - m.l) / banda)));
          destaque.setAttribute('x', m.l + banda * i); destaque.setAttribute('visibility', 'visible');
          mostrarDica(area, X(i), Y(pontos[i].valor), `<b>${rd(pontos[i].data)}</b><div><i class="graf-cor s1"></i>${esc(opcoes.nome)} <strong>${fmt(pontos[i].valor)}</strong></div>${opcoes.extraDica ? opcoes.extraDica(pontos[i]) : ''}`);
        };
        alvo.addEventListener('pointermove', mover);
        alvo.addEventListener('pointerdown', mover);
        alvo.addEventListener('pointerleave', () => { destaque.setAttribute('visibility', 'hidden'); esconderDica(area); });
        return s;
      },
    });
  }

  /**
   * Barras horizontais (ranking/categorias, uma série). opcoes: { titulo, itens:[{rotulo, valor, extra?}],
   *   nome, formato:'pct'|'num', cabecalho, colunaExtra, extraDica:(item)=>html, vazio }
   * Valor escrito na ponta de cada barra (substitui o eixo X); rótulo da categoria à esquerda.
   */
  function barrasH(caixa, opcoes) {
    const itens = (opcoes.itens || []).filter((p) => p.valor != null);
    const pctF = opcoes.formato === 'pct';
    const fmt = (v) => (v == null ? '—' : pctF ? fmtPct(v) : num2(v).replace(/,00$/, ''));
    montar(caixa, {
      titulo: opcoes.titulo,
      vazio: itens.length ? '' : (opcoes.vazio || 'Sem dados neste filtro.'),
      legenda: '',
      tabela: tabelaHtml([opcoes.cabecalho || '', opcoes.nome].concat(opcoes.colunaExtra ? [opcoes.colunaExtra] : []),
        itens.map((p) => [p.rotulo, fmt(p.valor)].concat(opcoes.colunaExtra ? [p.extra != null ? String(p.extra) : ''] : []))),
      desenhar(w, area) {
        const linhaH = 30, barraH = 14;
        const m = { t: 4, r: 52, b: 4, l: Math.min(w < 480 ? 118 : 180, Math.round(w * 0.42)) };
        const pw = Math.max(20, w - m.l - m.r);
        const h = m.t + m.b + itens.length * linhaH;
        const max = pctF ? 1 : Math.max(...itens.map((p) => p.valor), 1);
        const X = (v) => m.l + (v / max) * pw;
        const s = svg(w, h, `${opcoes.titulo || opcoes.nome}: ${itens.length} itens`);
        const maxChars = Math.floor((m.l - 10) / 6.4);
        add(s, 'line', { x1: m.l, x2: m.l, y1: m.t, y2: h - m.b, class: 'graf-base' });
        itens.forEach((p, i) => {
          const yc = m.t + i * linhaH + linhaH / 2;
          const rot = p.rotulo.length > maxChars ? p.rotulo.slice(0, maxChars - 1) + '…' : p.rotulo;
          const t = add(s, 'text', { x: m.l - 8, y: yc + 4, 'text-anchor': 'end', class: 'graf-cat' }, rot);
          if (rot !== p.rotulo) add(t, 'title', {}, p.rotulo);
          const larg = Math.max(0, X(p.valor) - m.l), y = yc - barraH / 2, x0 = m.l + 1, x1 = m.l + larg;
          const r = Math.min(4, barraH / 2, Math.max(0, x1 - x0));
          // Ponta arredondada (4 px) à direita, base reta no eixo
          if (x1 - x0 > 1) add(s, 'path', { d: `M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + barraH - r} Q${x1},${y + barraH} ${x1 - r},${y + barraH} H${x0} Z`, class: 'graf-barra s1' });
          add(s, 'text', { x: x1 + 6, y: yc + 4, class: 'graf-rotulo-direto' }, fmt(p.valor));
        });
        const destaque = add(s, 'rect', { x: 0, y: 0, width: w, height: linhaH, class: 'graf-destaque', visibility: 'hidden' });
        const alvo = add(s, 'rect', { x: 0, y: m.t, width: w, height: h - m.t - m.b, fill: 'transparent' });
        const mover = (ev) => {
          const r = s.getBoundingClientRect();
          const i = Math.max(0, Math.min(itens.length - 1, Math.floor((ev.clientY - r.top - m.t) / linhaH)));
          const p = itens[i];
          destaque.setAttribute('y', m.t + i * linhaH); destaque.setAttribute('visibility', 'visible');
          mostrarDica(area, Math.min(X(p.valor), w - 40), m.t + i * linhaH + 4, `<b>${esc(p.rotulo)}</b><div><i class="graf-cor s1"></i>${esc(opcoes.nome)} <strong>${fmt(p.valor)}</strong></div>${opcoes.extraDica ? opcoes.extraDica(p) : ''}`);
        };
        alvo.addEventListener('pointermove', mover);
        alvo.addEventListener('pointerdown', mover);
        alvo.addEventListener('pointerleave', () => { destaque.setAttribute('visibility', 'hidden'); esconderDica(area); });
        return s;
      },
    });
  }

  /** Mini linha 0–100% (string SVG). valores: números 0–1 ou null. meta opcional (0–1). */
  function sparkline(valores, meta, largura = 96, altura = 26) {
    const v = (valores || []).filter((x) => x != null);
    if (!v.length) return '<span class="nota">—</span>';
    const n = v.length, p = 3;
    const X = (i) => (n === 1 ? largura / 2 : p + (i * (largura - 2 * p)) / (n - 1));
    const Y = (x) => p + (1 - Math.max(0, Math.min(1, x))) * (altura - 2 * p);
    const metaLinha = meta != null && meta !== '' ? `<line x1="0" x2="${largura}" y1="${Y(meta)}" y2="${Y(meta)}" class="graf-ref-meta fina"/>` : '';
    return `<svg class="sparkline" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="Tendência: de ${fmtPct(v[0])} para ${fmtPct(v[n - 1])}">${metaLinha}
      <polyline points="${v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join(' ')}" class="graf-linha s1 fina"/>
      <circle cx="${X(n - 1)}" cy="${Y(v[n - 1])}" r="2.5" class="graf-ponto-fim s1"/></svg>`;
  }

  return { linha, barras, barrasH, sparkline };
})();
