import React, { useEffect, useState } from 'react';

function Icon({ name, size = 20, ...props }) {
  const paths = {
    link: <><path d="m10 13 4-4" /><path d="M8 16H6a4 4 0 0 1 0-8h3m6 0h3a4 4 0 0 1 0 8h-3" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H4v17h17v-6" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7" /></>,
    refresh: <><path d="M20 7V3m0 4h-4M4 17v4m0-4h4" /><path d="M20 7a9 9 0 0 0-15-2M4 17a9 9 0 0 0 15 2" /></>,
    cursor: <><path d="m5 3 14 10-7 1-3 7-4-18Z" /><path d="m13 15 4 5" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error('Could not connect to the API. Please try again.');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('The API is unavailable. Please try again.');
  }
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body.data;
}

function displayUrl(url) {
  return url.replace(/^https?:\/\//, '');
}

export default function App() {
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');
  const [deleting, setDeleting] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [notice, setNotice] = useState('');

  async function loadLinks() {
    setLoading(true);
    try {
      setLinks(await request('/api/links'));
      setError('');
    } catch {
      setError('Could not connect to the API. Make sure the server is running, then refresh.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLinks(); }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(''), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  async function shorten(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const link = await request('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), ...(customAlias.trim() ? { customAlias: customAlias.trim() } : {}) })
      });
      setLinks((current) => [link, ...current.filter((item) => item.code !== link.code)]);
      setResult(link);
      setUrl('');
      setCustomAlias('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(link) {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopied(link.code);
      setNotice('Link copied to clipboard.');
    } catch {
      setError('Clipboard access is unavailable. Select and copy the short URL manually.');
    }
  }

  async function remove(link) {
    setDeleting(link.code);
    try {
      await request(`/api/links/${encodeURIComponent(link.code)}`, { method: 'DELETE' });
      setLinks((current) => current.filter((item) => item.code !== link.code));
      if (result?.code === link.code) setResult(null);
      setNotice('Link deleted.');
      setConfirmDelete('');
      setError('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setDeleting('');
    }
  }

  const totalClicks = links.reduce((total, link) => total + link.clicks, 0);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="LinkForge home"><span className="brand-icon"><Icon name="link" size={26} /></span>Link<span>Forge</span><span className="brand-dot">.</span></a>
        <a className="header-link" href="#your-links">Your links <Icon name="arrow" size={17} /></a>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span /> LESS URL. MORE POSSIBILITY.</div>
          <h1 id="hero-title">Good things come<br />in <span>short links.</span><svg className="underline" viewBox="0 0 310 16" aria-hidden="true"><path d="M3 11C85 1 178 2 306 7" /></svg></h1>
          <p className="hero-description">Turn long, tangled URLs into clean links.<br className="desktop-break" /> Easy to share. Easy to remember. Ready to go.</p>
        </section>

        <section className="shortener-card" aria-labelledby="shortener-title">
          <div className="card-heading"><span className="small-icon"><Icon name="link" /></span><div><h2 id="shortener-title">Make your next link a little lighter</h2><p>Paste a URL and we’ll take care of the rest.</p></div></div>
          <form onSubmit={shorten}>
            <label htmlFor="long-url">Destination URL</label>
            <div className="url-field"><Icon name="link" /><input id="long-url" type="url" placeholder="https://example.com/your-very-long-link" value={url} onChange={(event) => setUrl(event.target.value)} required autoComplete="url" /><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Shortening…' : 'Shorten link'}<Icon name="arrow" size={18} /></button></div>
            <div className="alias-row"><div className="alias-field"><label htmlFor="custom-alias">Custom alias <span>optional</span></label><input id="custom-alias" placeholder="e.g. summer-launch" value={customAlias} onChange={(event) => setCustomAlias(event.target.value)} minLength={3} maxLength={32} pattern={'[A-Za-z0-9_\\-]{3,32}'} title="Use 3–32 letters, numbers, hyphens, or underscores." aria-describedby="alias-help" /></div><p id="alias-help"><Icon name="spark" size={15} /> A little personality goes a long way.<br />Use 3–32 letters, numbers, hyphens, or underscores.</p></div>
          </form>
          {error && <div className="error-message" role="alert">{error}</div>}
          {result && <div className="result-panel"><div><span className="result-label"><Icon name="check" size={15} /> Your short link is ready</span><a href={result.shortUrl} target="_blank" rel="noreferrer">{result.shortUrl}</a></div><button type="button" className="copy-result" onClick={() => copy(result)}><Icon name={copied === result.code ? 'check' : 'copy'} size={17} />{copied === result.code ? 'Copied!' : 'Copy link'}</button></div>}
        </section>

        <section className="stats-grid" aria-label="Link statistics"><div className="stat-card"><span className="stat-icon"><Icon name="link" /></span><div><span className="stat-label">Links created</span><strong>{links.length.toLocaleString()}</strong></div><span className="stat-note">Small but mighty</span></div><div className="stat-card"><span className="stat-icon lavender"><Icon name="cursor" /></span><div><span className="stat-label">Total clicks</span><strong>{totalClicks.toLocaleString()}</strong></div><span className="stat-note">Every connection counts</span></div></section>

        <section className="links-section" id="your-links" aria-labelledby="links-title">
          <div className="section-heading"><div><h2 id="links-title">Your links <span>{links.length}</span></h2><p>All your shortcuts, in one place.</p></div><button className="refresh-button" onClick={loadLinks} disabled={loading} aria-label="Refresh links and click counts"><Icon name="refresh" size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
          <div className="links-table">
            <div className="table-heading"><span>LINK</span><span>CREATED</span><span>CLICKS</span><span>ACTIONS</span></div>
            {loading && links.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="refresh" size={27} /></span><h3>Gathering your links…</h3><p>Just a moment.</p></div> : links.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="link" size={29} /></span><h3>Your first shortcut starts here</h3><p>Shorten a link above and watch your collection grow.</p><span className="empty-detail">BIG IDEAS. SMALL LINKS.</span></div> : links.map((link) => <div className="link-row" key={link.code}>
              <div className="link-details"><a className="short-link" href={link.shortUrl} target="_blank" rel="noreferrer">{displayUrl(link.shortUrl)}<Icon name="external" size={14} /></a><a className="destination-link" href={link.url} target="_blank" rel="noreferrer" title={link.url}>{link.url}</a></div>
              <time dateTime={link.createdAt}>{new Date(link.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
              <span className="click-count"><Icon name="cursor" size={14} />{link.clicks.toLocaleString()}</span>
              <div className="row-actions">{confirmDelete === link.code ? <><button className="delete-confirm" onClick={() => remove(link)} disabled={deleting === link.code}>{deleting === link.code ? 'Deleting…' : 'Delete?'}</button><button className="cancel-delete" onClick={() => setConfirmDelete('')} aria-label="Cancel deletion">Cancel</button></> : <><button className="icon-button" onClick={() => copy(link)} aria-label={`Copy link ${link.code}`} title="Copy link"><Icon name={copied === link.code ? 'check' : 'copy'} size={17} /></button><button className="icon-button delete-button" onClick={() => setConfirmDelete(link.code)} aria-label={`Delete link ${link.code}`} title="Delete link"><Icon name="trash" size={17} /></button></>}</div>
            </div>)}
          </div>
          <p className="storage-note">Links are stored for this server session. A restart gives you a fresh start.</p>
        </section>
      </main>
      <footer><span>© {new Date().getFullYear()} LinkForge</span><span>Built for a more connected web.<span className="footer-spark">✳</span></span></footer>
      <div className="sr-only" role="status" aria-live="polite">{notice}</div>
    </div>
  );
}
