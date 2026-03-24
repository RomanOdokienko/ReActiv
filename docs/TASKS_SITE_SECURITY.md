# Zadachi Po Zashchite Saita (reactiv.pro)

Poslednee obnovlenie: 2026-03-24
Otvetstvennyi po ispolneniyu: Codex + vladelets proekta

## Zachem etot fail
Eto edinaya tochka pravdy po zadacham bezopasnosti i tekhnicheskoi ustoychivosti dlya `reactiv.pro` i `api.reactiv.pro`.
Kogda v chate pishesh "zadachi po zashchite saita", orientir -- etot fail.

## Kontekst (srez audita)
- Proveren front `reactiv.pro` i API `api.reactiv.pro`.
- Naiti kritichnye zony:
  - slishkom shirokii CORS (origin reflection + credentials),
  - legkaya massovaya vygruzka kataloga cherez public API,
  - otsutstvie chasty security headers,
  - slabaya mobile performance,
  - parallelno zhivut `www` i `non-www` bez zhestkoi kanonikalizatsii khosta.

## Statusy
- `todo` -- ne nachinali
- `in_progress` -- v rabote
- `blocked` -- est vneshnyaya blokirovka/reshenie
- `done` -- sdelano i provereno
- `deferred` -- otlozheno po soglasovaniyu

## Reestr zadach
| ID | Kategoriya | Prioritet | Status | Zadacha | Chto schitaem gotovnostyu |
|---|---|---|---|---|---|
| SEC-00 | Security | P0 | todo | Utverdit matricu dostupa `endpoint -> public/auth/admin` | Est utverzhdennyi dokument po vsem endpointam |
| SEC-01 | Security | P0 | todo | Ogranichit CORS do allowlist doverennykh originov | Chuzhie Origin ne poluchayut ACAO, doverennye rabotayut |
| SEC-02 | Security | P0 | todo | Vvesti CSRF-zashchitu dlya cookie-auth state-changing endpointov | POST/PUT/PATCH/DELETE bez validnogo tokena otklonyayutsya |
| SEC-03 | Security | P0 | todo | Dobavit bazovye security headers na front/API | HSTS/CSP/XFO/XCTO/Referrer-Policy/Permissions-Policy otdayutsya stabilno |
| API-01 | API Protection | P1 | todo | Ogranichit massovyi scraping kataloga (rate limit, limity page size, anti-abuse) | Avtomatizirovannaya vygruzka suzhena, vitrina ne lomaetsya |
| API-02 | Data Exposure | P1 | todo | Minimizirovat public polya kataloga | Public otvety soderzhat tolko utverzhdennyi nabor polei |
| PERF-01 | Performance | P1 | todo | Vkluchit gzip/br i korrektnye cache headers | V otvetakh est content-encoding i adekvatnyi cache-control |
| PERF-02 | Performance | P1 | todo | Snizit vliyanie 3rd-party skriptov (chat/metrics) | Metriki LCP/TBT/CLS uluchsheny bez poteri kritichnoi analitiki |
| SEO-01 | SEO | P2 | todo | Sdelat zhestkuyu kanonizatsiyu hosta (`www` vs `non-www`) | Odin kanonicheskii host + redirect 301/308 |
| QA-01 | Verification | P1 | todo | Povtornyi audit posle fixov | Est otchet "do/posle" i ostatochnye riski |

## Zavisimosti i resheniya (nuzhno utverdit)
| ID | Reshenie | Status |
|---|---|---|
| DEC-01 | Kanonicheskii domen: `reactiv.pro` ili `www.reactiv.pro` | pending |
| DEC-02 | Spisok razreshennykh Originov (prod/stage/local) | pending |
| DEC-03 | Spisok public polei kataloga | pending |
| DEC-04 | Tselevoe SLO po frontend-metrikam (LCP/TBT/CLS) | pending |

## Zhurnal rabot
| Data | ID | Deistvie | Rezultat |
|---|---|---|---|
| 2026-03-24 | INIT | Sozdan fail-treker | Aktivnyi backlog zadach po zashchite saita |

## Pravilo vedeniya
- Ne obyazatelno idti po poryadku.
- Pri lyubom starte raboty menyaem status na `in_progress`.
- Posle proverki menyaem na `done` i dopisyvaem stroku v "Zhurnal rabot".
- Esli est blokiruyushchee reshenie, stavim `blocked` i ukazyvaem prichinu.


