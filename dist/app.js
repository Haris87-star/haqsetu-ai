import {matchScheme,parseProfile,toFormValues,toEngineProfile} from './engine.js';
import {readVersionedSession,buildSession,maskSensitiveIds,eraseDemoData,SESSION_STORAGE_KEYS,profileSignature,isResultOutdated} from './persistence.js';
const $=id=>document.getElementById(id);const fields=['state','age','income','level'];let lang='en';
const translations={en:{discover:'Discover',tracker:'My tracker',about:'About',headline:"Opportunity shouldn't be hard to find.",subtitle:'Explore education-support schemes with transparent eligibility checks, document guidance, and a simple application tracker.',getStarted:'Find my schemes →',tryDemo:'Try sample student',discoverTitle:'Tell us your story',discoverDesc:'Type naturally, then confirm the details we identify.',storyLabel:'Describe your situation',understand:'Understand my details →',check:'Check eligibility →',trackerTitle:'Your application tracker',aboutTitle:'Technology that makes access simpler.'},kn:{discover:'ಯೋಜನೆಗಳು',tracker:'ನನ್ನ ಪ್ರಗತಿ',about:'ನಮ್ಮ ಬಗ್ಗೆ',headline:'ಅವಕಾಶಗಳನ್ನು ಹುಡುಕುವುದು ಕಷ್ಟವಾಗಬಾರದು.',subtitle:'ವಿದ್ಯಾರ್ಥಿ ನೆರವು ಯೋಜನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಅರ್ಹತೆಯ ಕಾರಣಗಳು ಮತ್ತು ದಾಖಲೆಗಳ ಪಟ್ಟಿಯನ್ನು ನೋಡಿ.',getStarted:'ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ →',tryDemo:'ಮಾದರಿ ವಿದ್ಯಾರ್ಥಿ',discoverTitle:'ನಿಮ್ಮ ಬಗ್ಗೆ ತಿಳಿಸಿ',discoverDesc:'ಸರಳವಾಗಿ ಬರೆಯಿರಿ ಮತ್ತು ಮಾಹಿತಿಯನ್ನು ದೃಢೀಕರಿಸಿ.',storyLabel:'ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ವಿವರಿಸಿ',understand:'ವಿವರಗಳನ್ನು ಗುರುತಿಸಿ →',check:'ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ →',trackerTitle:'ಅರ್ಜಿ ಪ್ರಗತಿ',aboutTitle:'ಸಹಾಯವನ್ನು ಸುಲಭಗೊಳಿಸುವ ತಂತ್ರಜ್ಞಾನ.'}};
const UI_TEXT={"skip":{"en":"Skip to main content","kn":"ಮುಖ್ಯ ವಿಷಯಕ್ಕೆ ಹೋಗಿ"},"appName":{"en":"HaqSetu AI","kn":"ಹಕ್‌ಸೇತು AI"},"demoBannerTitle":{"en":"Demo prototype","kn":"ಪ್ರಾಯೋಗಿಕ ಮಾದರಿ"},"demoBannerText":{"en":"All scheme records and personas are fictional demo data, not verified government information.","kn":"ಎಲ್ಲಾ ಯೋಜನೆಗಳು ಮತ್ತು ಮಾದರಿ ವ್ಯಕ್ತಿಗಳ ವಿವರಗಳು ಕಾಲ್ಪನಿಕವಾಗಿವೆ; ಇವು ಪರಿಶೀಲಿತ ಸರ್ಕಾರಿ ಮಾಹಿತಿಯಲ್ಲ."},"loading":{"en":"Loading…","kn":"ಲೋಡ್ ಆಗುತ್ತಿದೆ…"},"step1":{"en":"STEP 01 · YOUR PROFILE","kn":"ಹಂತ 01 · ನಿಮ್ಮ ವಿವರಗಳು"},"profileTitle":{"en":"Find support that fits your situation","kn":"ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ನೆರವನ್ನು ಹುಡುಕಿ"},"profileHelp":{"en":"Describe your circumstances or try a fictional example. Review the extracted details before checking.","kn":"ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ವಿವರಿಸಿ ಅಥವಾ ಕಾಲ್ಪನಿಕ ಉದಾಹರಣೆ ಬಳಸಿ. ಪರಿಶೀಲಿಸುವ ಮೊದಲು ವಿವರಗಳನ್ನು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ."},"storyLabel":{"en":"Describe your situation","kn":"ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ವಿವರಿಸಿ"},"voice":{"en":"Speak my story","kn":"ಮಾತನಾಡಿ ವಿವರಿಸಿ"},"extract":{"en":"Understand my details","kn":"ನನ್ನ ವಿವರಗಳನ್ನು ಗುರುತಿಸಿ"},"stateLabel":{"en":"State","kn":"ರಾಜ್ಯ"},"ageLabel":{"en":"Age","kn":"ವಯಸ್ಸು"},"incomeLabel":{"en":"Annual income (₹)","kn":"ವಾರ್ಷಿಕ ಆದಾಯ (₹)"},"levelLabel":{"en":"Education level","kn":"ಶಿಕ್ಷಣ ಮಟ್ಟ"},"step2":{"en":"STEP 02 · EXPLORE","kn":"ಹಂತ 02 · ಅನ್ವೇಷಿಸಿ"},"exploreTitle":{"en":"Try a demo or check your eligibility","kn":"ಮಾದರಿ ಬಳಸಿ ಅಥವಾ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ"},"tryDemo":{"en":"Try sample student","kn":"ಮಾದರಿ ವಿದ್ಯಾರ್ಥಿಯನ್ನು ಬಳಸಿ"},"personaLabel":{"en":"Demo persona","kn":"ಮಾದರಿ ವ್ಯಕ್ತಿ"},"loadPersona":{"en":"Load persona","kn":"ಮಾದರಿ ವಿವರಗಳನ್ನು ತುಂಬಿ"},"checkEligibility":{"en":"Check eligibility","kn":"ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ"},"erase":{"en":"Erase saved demo data","kn":"ಉಳಿಸಿದ ಮಾದರಿ ಮಾಹಿತಿಯನ್ನು ಅಳಿಸಿ"},"step3":{"en":"STEP 03 · STAY ORGANISED","kn":"ಹಂತ 03 · ಪ್ರಗತಿ ಗಮನಿಸಿ"},"trackerTitle":{"en":"Your application tracker","kn":"ನಿಮ್ಮ ಅರ್ಜಿ ಪ್ರಗತಿ"},"trackerHelp":{"en":"Track fictional demo applications and document readiness on this device.","kn":"ಈ ಸಾಧನದಲ್ಲಿ ಕಾಲ್ಪನಿಕ ಅರ್ಜಿಗಳು ಮತ್ತು ದಾಖಲೆಗಳ ಸಿದ್ಧತೆಯನ್ನು ಗಮನಿಸಿ."},"footerText":{"en":"HaqSetu AI is a hackathon prototype. Verify every scheme on its official government source before applying.","kn":"ಹಕ್‌ಸೇತು AI ಹ್ಯಾಕಥಾನ್ ಮಾದರಿ. ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮೊದಲು ಪ್ರತಿಯೊಂದು ಯೋಜನೆಯನ್ನು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಮೂಲದಲ್ಲಿ ಪರಿಶೀಲಿಸಿ."},"realLinksIntro":{"en":"To find real schemes, visit ","kn":"ನಿಜವಾದ ಯೋಜನೆಗಳಿಗಾಗಿ ಭೇಟಿ ನೀಡಿ: "},"nsp":{"en":"National Scholarship Portal","kn":"ರಾಷ್ಟ್ರೀಯ ವಿದ್ಯಾರ್ಥಿವೇತನ ಪೋರ್ಟಲ್"},"seva":{"en":"Karnataka Seva Sindhu","kn":"ಕರ್ನಾಟಕ ಸೇವಾ ಸಿಂಧು"},"install":{"en":"Install app","kn":"ಆ್ಯಪ್ ಸ್ಥಾಪಿಸಿ"},"eligible":{"en":"Likely eligible","kn":"ಅರ್ಹರಾಗಿರುವ ಸಾಧ್ಯತೆ"},"not_eligible":{"en":"Unlikely eligible","kn":"ಅರ್ಹರಾಗುವ ಸಾಧ್ಯತೆ ಕಡಿಮೆ"},"more_info_needed":{"en":"More information needed","kn":"ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಅಗತ್ಯ"},"why":{"en":"Why this result?","kn":"ಈ ಫಲಿತಾಂಶ ಏಕೆ?"},"docs":{"en":"Required documents","kn":"ಅಗತ್ಯ ದಾಖಲೆಗಳು"},"guidance":{"en":"Application guidance","kn":"ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ಮಾರ್ಗದರ್ಶನ"},"noSource":{"en":"No verified application deadline or official scheme source exists for this synthetic record.","kn":"ಈ ಕಾಲ್ಪನಿಕ ಯೋಜನೆಗೆ ಪರಿಶೀಲಿತ ಗಡುವು ಅಥವಾ ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಮೂಲವಿಲ್ಲ."},"saveTracker":{"en":"Save to tracker","kn":"ಪ್ರಗತಿ ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ"},"resultsEyebrow":{"en":"YOUR RESULTS","kn":"ನಿಮ್ಮ ಫಲಿತಾಂಶಗಳು"},"resultsTitle":{"en":"Transparent eligibility checks","kn":"ಪಾರದರ್ಶಕ ಅರ್ಹತಾ ಪರಿಶೀಲನೆ"},"resultsHelp":{"en":"Fictional test programmes only. Not real benefit offers.","kn":"ಇವು ಕಾಲ್ಪನಿಕ ಪರೀಕ್ಷಾ ಯೋಜನೆಗಳು ಮಾತ್ರ. ನಿಜವಾದ ಸೌಲಭ್ಯಗಳಲ್ಲ."},"needDetails":{"en":"need more details","kn":"ಹೆಚ್ಚಿನ ವಿವರಗಳು ಬೇಕು"},"noSaved":{"en":"No saved schemes yet. Check eligibility, then press \"Save to tracker\" on a scheme you want to follow.","kn":"ಇನ್ನೂ ಯಾವುದೇ ಯೋಜನೆ ಉಳಿಸಿಲ್ಲ. ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ, ನಂತರ ಬೇಕಾದ ಯೋಜನೆಯನ್ನು ಪ್ರಗತಿ ಪಟ್ಟಿಗೆ ಸೇರಿಸಿ."},"fictional":{"en":"Demonstration scheme (fictional) · Deadline not verified","kn":"ಮಾದರಿ ಯೋಜನೆ (ಕಾಲ್ಪನಿಕ) · ಗಡುವು ಪರಿಶೀಲಿಸಿಲ್ಲ"},"applicationStatus":{"en":"Application status","kn":"ಅರ್ಜಿ ಸ್ಥಿತಿ"},"documentsCount":{"en":"Documents","kn":"ದಾಖಲೆಗಳು"},"ready":{"en":"ready","kn":"ಸಿದ್ಧ"},"remove":{"en":"Remove from tracker","kn":"ಪ್ರಗತಿ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಿ"},"Not Started":{"en":"Not Started","kn":"ಇನ್ನೂ ಆರಂಭಿಸಿಲ್ಲ"},"In Progress":{"en":"In Progress","kn":"ಪ್ರಗತಿಯಲ್ಲಿದೆ"},"Submitted":{"en":"Submitted","kn":"ಸಲ್ಲಿಸಲಾಗಿದೆ"},"Completed":{"en":"Completed","kn":"ಪೂರ್ಣಗೊಂಡಿದೆ"},"outdated":{"en":"Outdated — Recheck Eligibility: your details changed. Select \"Check eligibility\" to refresh the results.","kn":"ಫಲಿತಾಂಶ ಹಳೆಯದಾಗಿದೆ — ನಿಮ್ಮ ವಿವರಗಳು ಬದಲಾಗಿವೆ. ಹೊಸ ಫಲಿತಾಂಶಕ್ಕಾಗಿ “ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ” ಒತ್ತಿ."},"already":{"en":"Already in your tracker","kn":"ಈಗಾಗಲೇ ಪ್ರಗತಿ ಪಟ್ಟಿಯಲ್ಲಿದೆ"},"saved":{"en":"Saved to tracker","kn":"ಪ್ರಗತಿ ಪಟ್ಟಿಗೆ ಸೇರಿಸಲಾಗಿದೆ"},"statusUpdated":{"en":"Status updated to","kn":"ಸ್ಥಿತಿ ಬದಲಾಗಿದೆ:"},"removed":{"en":"Removed from your tracker:","kn":"ಪ್ರಗತಿ ಪಟ್ಟಿಯಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ:"},"extracted":{"en":"Details extracted. Please confirm them.","kn":"ವಿವರಗಳನ್ನು ಗುರುತಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ."},"notExtracted":{"en":"Could not extract details. Please fill the fields manually.","kn":"ವಿವರಗಳನ್ನು ಗುರುತಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಕ್ಷೇತ್ರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ."},"badAge":{"en":"Enter a valid age from 0 to 120","kn":"0 ರಿಂದ 120 ರೊಳಗಿನ ಸರಿಯಾದ ವಯಸ್ಸು ನಮೂದಿಸಿ"},"badIncome":{"en":"Enter a valid annual income","kn":"ಸರಿಯಾದ ವಾರ್ಷಿಕ ಆದಾಯ ನಮೂದಿಸಿ"},"eraseConfirm":{"en":"Erase all saved demo data on this device, including your profile, story, results and tracker? This cannot be undone.","kn":"ಈ ಸಾಧನದಲ್ಲಿರುವ ನಿಮ್ಮ ವಿವರಗಳು, ಕಥೆ, ಫಲಿತಾಂಶಗಳು ಮತ್ತು ಪ್ರಗತಿ ಪಟ್ಟಿಯ ಎಲ್ಲ ಮಾದರಿ ಮಾಹಿತಿಯನ್ನು ಅಳಿಸಬೇಕೇ? ಇದನ್ನು ಹಿಂತಿರುಗಿಸಲಾಗುವುದಿಲ್ಲ."},"erased":{"en":"Saved demo data erased","kn":"ಉಳಿಸಿದ ಮಾದರಿ ಮಾಹಿತಿ ಅಳಿಸಲಾಗಿದೆ"},"eraseError":{"en":"Unable to erase all saved data","kn":"ಎಲ್ಲಾ ಉಳಿಸಿದ ಮಾಹಿತಿಯನ್ನು ಅಳಿಸಲಾಗಲಿಲ್ಲ"},"noPersonas":{"en":"No sample personas available","kn":"ಮಾದರಿ ವ್ಯಕ್ತಿಗಳ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ"},"loaded":{"en":"loaded","kn":"ತುಂಬಲಾಗಿದೆ"},"voiceUnavailable":{"en":"Speech recognition unavailable. Please type your story.","kn":"ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ."},"voiceCaptured":{"en":"Voice captured. Review and extract details.","kn":"ಧ್ವನಿ ದಾಖಲಿಸಲಾಗಿದೆ. ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ."},"voiceError":{"en":"Voice unavailable. Please type instead.","kn":"ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಟೈಪ್ ಮಾಡಿ."},"saveError":{"en":"Unable to save profile on this device","kn":"ಈ ಸಾಧನದಲ್ಲಿ ವಿವರಗಳನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ"},"resultSaveError":{"en":"Unable to save results state on this device","kn":"ಈ ಸಾಧನದಲ್ಲಿ ಫಲಿತಾಂಶಗಳನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ"}};
const SUPPORTED_LANGS={en:'English',kn:'ಕನ್ನಡ',hi:'हिन्दी',ta:'தமிழ்',te:'తెలుగు',ml:'മലയാളം',mr:'मराठी'};
try { const r=await fetch('data/ui-languages.json'); if(r.ok){const data=await r.json(); for(const [code,values] of Object.entries(data)){if(!SUPPORTED_LANGS[code])continue;for(const [key,value] of Object.entries(values)){if(UI_TEXT[key]&&typeof value==='string'&&value.trim())UI_TEXT[key][code]=value;}}} } catch(e){console.warn('Extra language translations unavailable',e)}
const t=key=>UI_TEXT[key]?.[lang]||UI_TEXT[key]?.en||key;
function translatePage(){document.documentElement.lang=lang;document.querySelectorAll("[data-i18n]").forEach(el=>{if(UI_TEXT[el.dataset.i18n])el.textContent=t(el.dataset.i18n)});$("lang").value=lang;}
// Localize scheme content without changing eligibility calculations or tracker IDs.
const localized=(record,field,language=lang)=>record?.[`${field}_${language}`]||record?.[`${field}_en`]||record?.[`${field}_kn`]||'';
const localizedDoc=(doc)=>typeof doc==='string'?doc:(doc?.[lang]||doc?.en||doc?.kn||'');
// Engine-generated check details are in English/Kannada. Translate the stable rule
// labels from the scheme records; preserve engine details as a fallback.
function localizedCheck(check,scheme){
  const rule=(scheme.rules||[]).find(r=>r.id===check.id||r.id===check.rule_id||r.label_en===check.label_en);
  const label=rule?localized(rule,'label'):(lang==='kn'?(check.label_kn||check.label_en):(check.label_en||check.label_kn));
  const detail=lang==='kn'?(check.detail_kn||check.detail_en):(lang==='en'?(check.detail_en||check.detail_kn):'');
  return {label:label||'',detail:detail||''};
}
const safe=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let schemes=[],demoPersonas=[];
try{
  const [schemesData,personasData]=await Promise.all([fetch('data/schemes.json').then(r=>{if(!r.ok)throw new Error('schemes.json '+r.status);return r.json()}),fetch('data/personas.json').then(r=>{if(!r.ok)throw new Error('personas.json '+r.status);return r.json()})]);
  schemes=Array.isArray(schemesData?.schemes)?schemesData.schemes:[];
  demoPersonas=Array.isArray(personasData?.personas)?personasData.personas:[];
  document.querySelector('.loader')?.remove();
}catch(err){
  document.querySelector('.loader')?.remove();
  const errEl=$('data-error');
  errEl.textContent='App data could not load. Run npm start, then reload the page.';
  errEl.hidden=false;
  throw err;
}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').style.display='none',3500)}
function load(){try{return JSON.parse(localStorage.getItem('haqsetu-tracker')||'{}')}catch{return {}}}function save(d){localStorage.setItem('haqsetu-tracker',JSON.stringify(d))}
function profile(){return toEngineProfile(Object.fromEntries(fields.map(k=>[k,$(k).value])))}
const SESSION_KEY=SESSION_STORAGE_KEYS[0], SIG_KEY='haqsetu-results-sig';
let shownSig=null;
function formValues(){return Object.fromEntries(fields.map(k=>[k,$(k).value]))}
function currentSig(){return profileSignature(formValues(),maskSensitiveIds($('story').value))}
function saveSession(){
  try { localStorage.setItem(SESSION_KEY,JSON.stringify(buildSession({story:$('story').value,form:formValues(),savedAt:new Date().toISOString()}))); }
  catch { toast(t('saveError')); }
}
function updateOutdated(){
  let note=$('outdated-note');
  if(!note){note=document.createElement('p');note.id='outdated-note';note.setAttribute('role','status');$('results').before(note)}
  const outdated=shownSig!==null&&isResultOutdated(shownSig,currentSig());
  note.textContent=outdated?t('outdated'):'';
  note.hidden=!outdated;
}
function populate(p){for(const k of fields)if(p[k]!==undefined)$(k).value=p[k];saveSession();updateOutdated()}
function showResults({remember=true}={}){
  showResultsInner();
  if(remember){shownSig=currentSig();try{localStorage.setItem(SIG_KEY,shownSig)}catch{toast(t('resultSaveError'))}saveSession()}
  updateOutdated();
}
function showResultsInner(){
const p=profile();const schemeList=Array.isArray(schemes)?schemes:[];const result=schemeList.map(s=>matchScheme(p,s));const txt=v=>safe(v==null?'':v);const statusMap={eligible:[t('eligible'),'eligible'],not_eligible:[t('not_eligible'),'no'],more_info_needed:[t('more_info_needed'),'maybe']};const card=r=>{const st=statusMap[r.status]||[t('more_info_needed'),'maybe'];const s=schemeList.find(x=>x.id===r.scheme_id)||{};const checks=(r.checks||[]).map(c=>{const sym=c.result==='pass'?'✓':c.result==='fail'?'✕':'❔';const {label,detail}=localizedCheck(c,s);return `<li>${sym} <b>${txt(label)}</b>${detail?`: ${txt(detail)}`:''}</li>`}).join('');const docs=(s.documents||[]).map((doc,i)=>{const docLabel=localizedDoc(doc);return `<li>${txt(docLabel)}</li>`}).join('');const stepArr=s[`apply_steps_${lang}`]||s.apply_steps_en;const steps=(stepArr||[]).map(d=>`<li>${txt(d)}</li>`).join('');return `<article class="result"><span class="tag ${st[1]}">${st[0]}</span><h3>${txt(localized(s,'name'))}</h3><details><summary>${t('why')}</summary><ul>${checks}</ul></details><details><summary>${t('docs')}</summary><ul>${docs}</ul></details><details><summary>${t('guidance')}</summary><ol>${steps}</ol><p>${t('noSource')}</p></details><button type="button" class="primary save-btn" data-id="${txt(r.scheme_id)}">${t('saveTracker')}</button></article>`};$('results').innerHTML=`<div class="section-head" style="margin-top:35px"><div><span class="eyebrow">${t('resultsEyebrow')}</span><h2>${t('resultsTitle')}</h2><p>${t('resultsHelp')}</p></div></div><div class="results-summary"><span><strong>${result.filter(x=>x.status==='eligible').length}</strong> ${t('eligible')}</span><span><strong>${result.filter(x=>x.status==='more_info_needed').length}</strong> ${t('needDetails')}</span><span><strong>${result.filter(x=>x.status==='not_eligible').length}</strong> ${t('not_eligible')}</span></div><div class="result-grid">${result.map(card).join('')}</div>`;document.querySelectorAll('.save-btn').forEach(b=>b.onclick=()=>{const d=load();if(d[b.dataset.id]){toast(t('already'));}else{d[b.dataset.id]={status:'Not Started',checked:[]};save(d);renderTracker();toast(t('saved'));}location.hash='#tracker'});}
function renderTracker(){
  const STATUSES=['Not Started','In Progress','Submitted','Completed'];
  const LEGACY={Preparing:'In Progress',Applied:'Submitted','Under Review':'Submitted',Approved:'Completed',Rejected:'Submitted'};
  const normStatus=s=>STATUSES.includes(s)?s:(LEGACY[s]||'Not Started');
  const d=load();
  const entries=Object.entries(d).filter(([id])=>schemes.some(s=>s.id===id));
  const docText=localizedDoc;
  if(!entries.length){
    $('tracked').innerHTML=`<p class="muted">${t('noSaved')}</p>`;
    return;
  }
  $('tracked').innerHTML=entries.map(([id,v])=>{
    const s=schemes.find(x=>x.id===id)||{};
    const name=localized(s,'name');
    const docs=Array.isArray(s.documents)?s.documents:[];
    const total=docs.length;
    const checked=[...new Set((Array.isArray(v.checked)?v.checked:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<total))];
    const done=checked.length;
    const pct=total?Math.round(done/total*100):0;
    const status=normStatus(v.status);
    const opts=STATUSES.map(st=>`<option value="${safe(st)}"${st===status?' selected':''}>${safe(t(st))}</option>`).join('');
    const items=docs.map((doc,i)=>`<label class="doc-item"><input type="checkbox" data-check="${safe(id)}" data-index="${i}"${checked.includes(i)?' checked':''}> ${safe(docText(doc))}</label>`).join('');
    return `<article class="track-card" data-scheme="${safe(id)}"><h3>${safe(name)}</h3><p class="muted">${t('fictional')}</p><label>${t('applicationStatus')} <select data-status="${safe(id)}">${opts}</select></label><p class="track-progress">${t('documentsCount')}: ${done} / ${total} ${t('ready')}</p><div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Document checklist progress"><span style="width:${pct}%"></span></div><div class="checklist">${items}</div><button class="outline" type="button" data-remove="${safe(id)}">${t('remove')}</button></article>`;
  }).join('');
  document.querySelectorAll('[data-status]').forEach(el=>el.onchange=()=>{const d2=load();if(!d2[el.dataset.status])return;d2[el.dataset.status].status=normStatus(el.value);save(d2);toast(t('statusUpdated')+' '+t(normStatus(el.value)));renderTracker()});
  document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{const d2=load();const id=el.dataset.check;if(!d2[id])return;const set=new Set(Array.isArray(d2[id].checked)?d2[id].checked:[]);const i=Number(el.dataset.index);el.checked?set.add(i):set.delete(i);d2[id].checked=[...set].sort((a,b)=>a-b);save(d2);renderTracker()});
  document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{const id=el.dataset.remove;const s=schemes.find(x=>x.id===id)||{};const title=localized(s,'name');const d2=load();delete d2[id];save(d2);renderTracker();toast(t('removed')+' '+title)});
}
function loadPersona(id){const item=demoPersonas.find(x=>x.id===id)||demoPersonas[0];if(!item){toast(t('noPersonas'));return}populate(toFormValues(item.profile));$('story').value=item.description||'';showResults();location.hash='#discover';toast(item.name+' '+t('loaded'))}
$('tryDemo').onclick=()=>loadPersona('eligible');
$('persona').innerHTML=demoPersonas.map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('');
$('loadPersona').onclick=()=>loadPersona($('persona').value);
$('extract').onclick=()=>{const r=parseProfile($('story').value);const fv=toFormValues(r.profile);const found=Object.entries(fv).filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()!=='');if(found.length){populate(Object.fromEntries(found));toast(t('extracted'))}else toast(t('notExtracted'))};
$('match').onclick=()=>{const age=Number($('age').value),income=Number($('income').value);if($('age').value&&(age<0||age>120)){toast(t('badAge'));$('age').focus();return}if($('income').value&&(!Number.isFinite(income)||income<0)){toast(t('badIncome'));$('income').focus();return}showResults();$('results').scrollIntoView({behavior:'smooth'})};
$('reset').onclick=()=>{if(confirm(t('eraseConfirm'))){try{eraseDemoData(localStorage);localStorage.removeItem(SIG_KEY)}catch{toast(t('eraseError'));return}shownSig=null;fields.forEach(k=>$(k).value='');$('story').value='';$('results').innerHTML='';updateOutdated();renderTracker();toast(t('erased'))}};
$('lang').onchange=()=>{lang=SUPPORTED_LANGS[$('lang').value]?$('lang').value:'en';try{localStorage.setItem('haqsetu-language',lang)}catch{}translatePage();if($('results').innerHTML)showResults({remember:false});renderTracker();toast(SUPPORTED_LANGS[lang]+' selected')};
$('voice').onclick=()=>{const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){toast(t('voiceUnavailable'));return}const r=new Speech();r.lang=({en:'en-IN',kn:'kn-IN',hi:'hi-IN',ta:'ta-IN',te:'te-IN',ml:'ml-IN',mr:'mr-IN'})[lang]||'en-IN';r.onresult=e=>{$('story').value=e.results[0][0].transcript;saveSession();updateOutdated();toast(t('voiceCaptured'))};r.onerror=()=>toast(t('voiceError'));r.start()};
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('install').hidden=false});$('install').onclick=async()=>{if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('install').hidden=true}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
try{const savedLang=localStorage.getItem('haqsetu-language');lang=SUPPORTED_LANGS[savedLang]?savedLang:'en'}catch{}
translatePage();
renderTracker();
let saved;try{saved=readVersionedSession(localStorage.getItem(SESSION_KEY)||'')}catch{saved=readVersionedSession('')}
for(const k of fields)$(k).value=saved.form[k]||'';
$('story').value=saved.story||'';
for(const k of fields)$(k).addEventListener('input',()=>{saveSession();updateOutdated()});
$('story').addEventListener('input',()=>{saveSession();updateOutdated()});
let storedSig=null;try{storedSig=localStorage.getItem(SIG_KEY)}catch{}
if(storedSig&&saved.version===2){shownSig=storedSig;showResults({remember:false})}
else updateOutdated();
