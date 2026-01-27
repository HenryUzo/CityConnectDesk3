(async ()=>{
  try{
    const urls = [
      '/health',
      '/api/categories?scope=global',
      '/api/events'
    ];
    const base = 'http://localhost:5000';

    // health
    try{
      const r = await fetch(base+urls[0]);
      const t = await r.text();
      console.log('--- HEALTH ---');
      console.log('status', r.status);
      console.log(t);
    }catch(e){console.error('HEALTH ERR', e.message||e)}

    // categories
    try{
      const r = await fetch(base+urls[1]);
      const t = await r.text();
      console.log('\n--- CATEGORIES ---');
      console.log('status', r.status);
      console.log(t);
    }catch(e){console.error('CATEGORIES ERR', e.message||e)}

    // events (SSE) - read headers and first chunk then abort
    try{
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 3000);
      const r = await fetch(base+urls[2], { signal: controller.signal });
      console.log('\n--- EVENTS ---');
      console.log('status', r.status);
      console.log('headers:');
      for(const [k,v] of r.headers) console.log(k+':', v);
      // try to read first 512 chars of body stream
      const reader = r.body?.getReader();
      if(reader){
        const { value, done } = await reader.read();
        if(value) console.log('firstChunk:\n', new TextDecoder().decode(value));
        try{ reader.cancel(); }catch(e){}
      } else {
        console.log('no body reader');
      }
      clearTimeout(timeout);
    }catch(e){
      console.error('EVENTS ERR', e.type || e.code || e.message || e);
    }

  }catch(err){
    console.error('PROBE FAILED', err);
    process.exit(1);
  }
})();
