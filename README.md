<p align="center">
  <img src="./assets/hero-banner.svg?v=leo" width="100%" alt="Duong Thai Tan — code burns bright. Leo developer and UI/UX enthusiast from Vietnam, beneath the Leo constellation." />
</p>

<p align="center">
  <img src="./assets/typing-anim.svg?v=leo" width="500" alt="Leo Developer — Born August 18 — Frontend Engineer — UI/UX Enthusiast — Code burns bright" />
</p>

<h1 align="center">Duong Thai Tan</h1>
<p align="center">
  <strong>A Leo's creative force — bold code, fearless design, golden results.</strong><br />
  Frontend developer &amp; UI/UX enthusiast · Vietnam
</p>

<p align="center"><samp>BOLD VISION / FEARLESS EXECUTION / GOLDEN ENGINEERING</samp></p>

<p align="center">
  <a href="#mission-control">About</a> &nbsp; · &nbsp;
  <a href="#technology-constellation">Toolkit</a> &nbsp; · &nbsp;
  <a href="#selected-work">Work</a> &nbsp; · &nbsp;
  <a href="#github-snapshot">Telemetry</a> &nbsp; · &nbsp;
  <a href="#learning-coordinates">Learning</a> &nbsp; · &nbsp;
  <a href="#flight-systems">Systems</a> &nbsp; · &nbsp;
  <a href="#open-a-channel">Connect</a>
</p>

<br />

<img src="./assets/galaxy/about.svg?v=leo" width="100%" alt="" />

## Mission control

**Bold ideas. Fearless execution. One foot in engineering, one eye on the horizon.**

I build responsive web interfaces where layout, motion, and small details work together. The goal isn't just a good first impression — it's an experience supported by clean, maintainable code.

Beyond the editor, **photography and video editing** shape the way I see light, composition, and timing. Different tools; the same drive to turn an idea into something people can feel.

### In my current orbit

| Exploring | What draws me in |
| :--- | :--- |
| **Vue.js** | Reusable components and considered frontend architecture |
| **Three.js** | Interactive geometry and immersive web experiences |
| **Design systems** | Consistent interfaces, accessible patterns, less guesswork |

<br />

<img src="./assets/galaxy/toolkit.svg?v=leo" width="100%" alt="" />

## Technology constellation

**Different tools. One connected creative process.**

| System | Tools & technologies |
| :--- | :--- |
| **Interface engineering** | HTML · CSS · JavaScript · Vue.js · Bootstrap |
| **Creative development** | Three.js · Figma · Photoshop |
| **Everyday workflow** | GitHub · VS Code · MySQL · Selenium |

<details>
<summary><strong>Beyond the frontend / additional languages & frameworks</strong></summary>

PHP · Laravel · Java · C# · .NET · C++

Tools I've worked with along the way — a toolkit, not a proficiency ranking.

</details>

<br />

<img src="./assets/galaxy/selected-work.svg?v=leo" width="100%" alt="" />

## Selected work

### An orbital playground

**An interactive 3D portfolio built with Three.js.** A small universe of wireframe geometry, orbiting particles, bloom, and pointer interaction — where frontend engineering meets motion design.

- **Explore:** a scene that responds beyond a static page.
- **Built with:** HTML · CSS · JavaScript · Three.js.
- **The idea:** experiment with depth, atmosphere, and interaction on the web.

**[Explore the source](./3d-portfolio/index.html)** &nbsp; / &nbsp; **[Open the GitHub Pages version](https://duongthaitan.github.io/duongthaitan/3d-portfolio/index.html)**

<sub>The interactive scene runs on a separate page. This README's galaxy is SVG artwork, not embedded WebGL. The live version requires GitHub Pages to be enabled.</sub>

<br />

## GitHub snapshot

<p><samp>04 / OBSERVATORY</samp></p>

**A signal from the work, not a score for the developer.**

<p align="center">
  <img src="./assets/github-metrics.svg?v=leo" width="560" alt="GitHub observatory: public original repositories, stars on those repositories, and followers. The image includes values and its last successful UTC update. Accessible snapshot and public sources follow." />
</p>

| Reading | What it actually measures |
| :--- | :--- |
| **Original repositories** | Public repositories owned by this account, excluding forks; archived repositories included |
| **Stars** | Stars received by those same repositories, not stars I've given other projects |
| **Followers** | The account's public follower count |

[Accessible snapshot](./assets/github-metrics.svg?raw=1) · [Repositories](https://github.com/duongthaitan?tab=repositories) · [Followers](https://github.com/duongthaitan?tab=followers) · [Renderer source](./scripts/render-metrics.mjs)

<sub>Refreshed by GitHub Actions at 02:17 UTC / 09:17 Vietnam time each day. This is the last successful snapshot, not real-time activity. If an update fails, the previous data and timestamp remain intact.</sub>

<br />

<img src="./assets/galaxy/certificates.svg?v=leo" width="100%" alt="" />

## Learning coordinates

**Every new skill starts with a little curiosity.**

<details>
<summary><strong>Open the learning log / five course certificates</strong></summary>

| Provider | Course |
| :--- | :--- |
| **F8 Fullstack** | [IT Onboarding](https://fullstack.edu.vn/cert/4tv2o) |
| **F8 Fullstack** | [JavaScript Basic](https://fullstack.edu.vn/cert/d0gj4) |
| **F8 Fullstack** | [PHP Introduction](https://fullstack.edu.vn/cert/kj7vr) |
| **SoloLearn** | [PHP Course](https://www.sololearn.com/certificates/CT-11PGKZIX) |
| **SoloLearn** | [Introduction to C](https://www.sololearn.com/certificates/CC-USOBZSX7) |

</details>

<br />

<img src="./assets/galaxy/automation.svg?v=leo" width="100%" alt="" />

## Flight systems

**A little automation keeps this observatory in orbit.**

Local SVG artwork. Native JavaScript metrics. GitHub Actions on a daily schedule. No external stats-image service, tracking counter, or borrowed contribution graph.

<details>
<summary><strong>Inside the spacecraft / checks, updates & accessibility</strong></summary>

### Local checks

Requires **Node.js 24 or newer**. No install step.

```sh
node --test scripts/render-metrics.test.mjs
node scripts/render-metrics.mjs
```

The first command checks the renderer, local artwork, and README links. The second fetches public GitHub data and updates the local snapshot. No credentials are required locally; unauthenticated API rate limits apply.

### Automatic updates

1. Keep these files in the public **`duongthaitan/duongthaitan`** repository on **`main`**. Profile READMEs live at the root of a repository matching the account name.
2. Open **Actions → Update public profile metrics → Run workflow** for a manual refresh. The workflow uses GitHub's built-in token; no personal access token is needed.
3. Tests run before generation. Only **`assets/github-metrics.svg`** is updated automatically. Repository rules must permit the write; concurrent changes are checked, never force-pushed.

The daily schedule runs on the default branch. Changes to the README, galaxy artwork, renderer, or workflow also trigger checks and a refresh on `main`; the generated snapshot does not trigger a loop. GitHub may delay scheduled jobs or disable them after 60 days without repository activity — re-enable the workflow in Actions if needed.

### Motion with a quiet mode

The galaxy's depth comes from layered SVG geometry, lighting, and gradients. Decorative introductions finish within five seconds and respect reduced-motion preferences. Metrics stay still. When animation or images are unavailable, the profile's essential information and links remain in native text.

The metrics card has light, dark, and forced-color treatments. The galaxy illustrations use self-contained dark panels on either GitHub theme. Nothing in the README executes JavaScript or loads external fonts.

### The separate 3D experience

The portfolio source remains in **[3d-portfolio/](./3d-portfolio/index.html)**. Its live page needs a separate GitHub Pages deployment; the metrics workflow does not deploy it.

</details>

<br />

<img src="./assets/galaxy/connect.svg?v=leo" width="100%" alt="" />

<h2 align="center">Open a channel</h2>

<p align="center">
  <strong>Good ideas deserve somewhere to land.</strong><br />
  Frontend, visual experiments, or a different way of seeing things — let's connect.
</p>

<p align="center">
  <a href="https://github.com/duongthaitan">GitHub</a> &nbsp; / &nbsp;
  <a href="https://www.linkedin.com/in/duongthaitan/">LinkedIn</a> &nbsp; / &nbsp;
  <a href="https://www.instagram.com/thaitan.duong_">Photography &amp; Instagram</a>
</p>

<img src="./assets/section-divider.svg?v=leo" width="100%" alt="" />

<p align="center"><samp>STAY CURIOUS. KEEP BUILDING. EXPLORE FURTHER.</samp></p>
<p align="center"><sub>Duong Thai Tan · ♌ Leo Developer — designed with intent, down to the last detail.</sub></p>
