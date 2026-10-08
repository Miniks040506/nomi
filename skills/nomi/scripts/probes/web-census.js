// Paste the entire expression into a browser console. No dependencies or lasting DOM changes.
(async () => {
  const visible = el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    for(let e=el;e;e=e.parentElement) if(Number(getComputedStyle(e).opacity)===0)return false;
    return r.width > 0 && r.height > 0 && s.visibility === 'visible' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const elements = [...document.querySelectorAll('body *')].filter(visible);
  const texts = elements.filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  const node = el => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let e = el; e && e !== document.body && e.parentElement; e = e.parentElement) { // a page may replace an element while the focus pass runs
      parts.unshift(`${e.localName}:nth-child(${[...e.parentElement.children].indexOf(e) + 1})`);
    }
    return parts.length ? `body > ${parts.join(' > ')}` : 'body';
  };
  const unique = values => [...new Set(values)].sort((a,b) => typeof a === 'number' ? a-b : a.localeCompare(b));
  const rgba = color => {
    const m = /^rgba?\(([^)]+)\)$/.exec(color);
    if (!m) return null;
    const v = m[1].split(/[, /]+/).map(Number);
    return v.length === 3 ? [...v,1] : v;
  };
  const over = (a,b) => [0,1,2].map(i => a[i]*a[3]+b[i]*(1-a[3])).concat(1);
  function background(el) {
    const chain = [];
    for(let e=el;e;e=e.parentElement) {
      const s=getComputedStyle(e);
      if(Number(s.opacity)!==1 || s.mixBlendMode!=='normal' || s.filter!=='none')return null;
    }
    for (let e=el; e; e=e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none' || Number(s.opacity) !== 1 || s.mixBlendMode !== 'normal' || s.filter !== 'none') return null;
      const color = rgba(s.backgroundColor);
      if (!color) return null;
      chain.push(color);
      if (color[3] === 1) break;
    }
    return chain.reverse().reduce((b,a) => over(a,b), [255,255,255,1]);
  }
  const luminance = color => color.slice(0,3).map(v => { v/=255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  const contrast = texts.map(el => {
    const s=getComputedStyle(el), bg=background(el), fg=rgba(s.color), size=parseFloat(s.fontSize);
    const required = size>=24 || (size>=18.66 && Number(s.fontWeight)>=700) ? 3 : 4.5;
    // A transparent fill is drawn by a stroke or a clipped background: the text colour is not what people see.
    if (!bg || !fg || fg[3] === 0) return { node:node(el), status:'unknown', reason:'image, gradient, opacity, filter, transparent fill or unsupported color', required };
    const a=luminance(over(fg,bg)), b=luminance(bg), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    return { node:node(el), status:ratio>=required ? 'pass' : 'fail', ratio:Number(ratio.toFixed(2)), required };
  });
  const styles = texts.map(el => getComputedStyle(el));
  const sizes = unique(styles.map(s=>parseFloat(s.fontSize)));
  const ratios=[1.125,1.2,1.25,1.333,1.414,1.5];
  const fit = sizes.length>1 ? ratios.map(r=>({ ratio:r, error:sizes.reduce((sum,size)=>{const n=Math.round(Math.log(size/sizes[0])/Math.log(r));return sum+Math.abs(size-sizes[0]*r**n)/size;},0)/sizes.length })).sort((a,b)=>a.error-b.error)[0] : null;
  const allStyles=elements.map(el=>getComputedStyle(el));
  const colors={ text:unique(styles.map(s=>s.color)), background:unique(allStyles.map(s=>s.backgroundColor)), border:unique(allStyles.flatMap(s=>['Top','Right','Bottom','Left'].filter(side=>parseFloat(s[`border${side}Width`])>0).map(side=>s[`border${side}Color`]))) };
  const clusters=[];
  for(const color of unique(Object.values(colors).flat())) {
    const c=rgba(color); if(!c || c[3]===0) continue;
    let group=clusters.find(g=>Math.hypot(...c.slice(0,3).map((v,i)=>v-g.rgb[i]))<24);
    if(!group) clusters.push(group={rgb:c.slice(0,3),colors:[]}); group.colors.push(color);
  }
  const focusables=elements.filter(e=>e.matches('a[href],button,input:not([type=hidden]),select,textarea,[tabindex]') && !e.disabled && e.tabIndex>=0 && !e.closest('[inert]'));
  const active=document.activeElement, scroll=[scrollX,scrollY], missing=[];
  const appearance=e=> {const s=getComputedStyle(e);return {outline:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&(rgba(s.outlineColor)?.[3]??0)>0,shadow:s.boxShadow,border:s.borderColor,background:s.backgroundColor};};
  try {
    for(const e of focusables.slice(0,200)) {
      const before=appearance(e); e.focus({preventScroll:true}); const after=appearance(e);
      if(document.activeElement===e && !after.outline && after.shadow===before.shadow && after.border===before.border && after.background===before.background) missing.push({node:node(e)});
    }
  } finally { if(active && active!==document.body) active.focus({preventScroll:true}); else document.activeElement?.blur(); scrollTo(...scroll); }
  const scrollsSideways=document.documentElement.scrollWidth>document.documentElement.clientWidth+1;
  const rootStyle=getComputedStyle(document.documentElement), properties={};
  for(const name of rootStyle) if(name.startsWith('--')) properties[name]=rootStyle.getPropertyValue(name).trim();
  const copy=texts.map(e=>(e.innerText || e.textContent).trim()).join('\n');
  return {
    type:{families:unique(styles.map(s=>s.fontFamily)),sizes,weights:unique(styles.map(s=>s.fontWeight)),lineHeights:unique(styles.map(s=>s.lineHeight)),scaleFit:fit,renderedFamilies:null},
    colors, colorClusters:clusters,
    spacing:unique(allStyles.flatMap(s=>['marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','gap'].map(k=>s[k]))),
    radii:unique(allStyles.flatMap(s=>[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius])), shadows:unique(allStyles.map(s=>s.boxShadow)),
    contrast,
    overflow:elements.filter(e=>{
      const r=e.getBoundingClientRect();let left=r.left,right=r.right;
      for(let parent=e.parentElement;parent&&parent!==document.body&&parent!==document.documentElement;parent=parent.parentElement) {
        if(['auto','scroll','hidden','clip'].includes(getComputedStyle(parent).overflowX)) {const bounds=parent.getBoundingClientRect();left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}
      }
      if(right<=0)return false; // wholly off the left edge (skip links): unreachable, not overflow
      const width=document.documentElement.clientWidth, beyond=Math.max(right-width,-left);
      // Without sideways scrolling, clipped bleed up to 8 px is optical alignment, not lost content.
      return scrollsSideways ? beyond>1 : left<width && beyond>8;
    }).map(e=>({node:node(e),width:Math.round(e.getBoundingClientRect().width)})),
    tapTargets:focusables.filter(e=>{const r=e.getBoundingClientRect();return r.width<24 || r.height<24;}).map(e=>({node:node(e),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)})),
    lineLength:texts.filter(e=>e.matches('p,li')).map(e=>({node:node(e),approxCharacters:Math.round(e.getBoundingClientRect().width/(parseFloat(getComputedStyle(e).fontSize)*.5))})),
    headings:elements.filter(e=>/^H[1-6]$/.test(e.tagName)).map(e=>({level:Number(e.tagName[1]),text:e.textContent.trim().slice(0,120)})),
    controls:elements.filter(e=>e.matches('button,input:not([type=hidden]),select,textarea')).length,
    primaryActions:elements.filter(e=>e.matches('[data-primary],.primary,[aria-current="page"]')).map(e=>({node:node(e),text:e.textContent.trim().slice(0,80)})),
    focus:{method:'programmatic focus-visible heuristic; event handlers may run',tested:Math.min(200,focusables.length),nodes:focusables.slice(0,200).map(node),missing,truncated:focusables.length>200},
    nodes:elements.map(node),
    customProperties:properties, copy,
    notes:['Computed families are CSS stacks; actual platform fonts require CDP.', 'Contrast excludes pseudo-elements, shadow roots, canvas and occlusion; unknown is not a pass.', 'Tap targets use the 24 CSS px size test only; spacing exceptions require review.', 'Line length and primary actions are heuristics, not accessibility failures.']
  };
})()
