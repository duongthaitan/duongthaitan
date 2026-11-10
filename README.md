<a href="https://duongthaitan.github.io/duongthaitan/terminal/"><img src="./assets/brand.svg" width="100%" alt="tandev: a silver Fujifilm X-T5 with a 25mm lens and a speedlight, in 3D, taking a picture every few seconds (half-press, full press, flash), beside the wordmark tandev." /></a>

<div align="center">
  <a href="https://duongthaitan.github.io/duongthaitan/terminal/"><img src="./assets/hero-banner.svg" width="100%" alt="Duong Thai Tan: full-stack developer, cloud infrastructure builder, visual creator. I build web apps and the cloud systems that run them. Opens the interactive terminal." /></a>
</div>

<p align="center">
  <a href="#about"><img src="./assets/keys/about.svg" width="126" alt="~/about" /></a>
  <a href="#toolkit"><img src="./assets/keys/toolkit.svg" width="126" alt="~/toolkit" /></a>
  <a href="#selected-work"><img src="./assets/keys/selected-work.svg" width="126" alt="~/projects" /></a>
  <a href="#certificates"><img src="./assets/keys/certificates.svg" width="126" alt="~/certificates" /></a>
  <a href="#automation"><img src="./assets/keys/automation.svg" width="126" alt="~/automation" /></a>
  <a href="#connect"><img src="./assets/keys/connect.svg" width="126" alt="~/connect" /></a>
</p>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/"><img src="./assets/launch.svg" width="100%" alt="Open the interactive 3D terminal: type commands, tilt the terminal with your pointer and press the tool keys." /></a>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/"><img src="./assets/typing-anim.svg" width="100%" alt="neofetch for thaitan@github, with a 3D voxel &lt;T/&gt; logo. Role: full-stack developer. Location: Soc Trang, Vietnam. Shipping: TypeScript across the stack. Stack: React, Node.js, PostgreSQL, AWS. Focus: clean architecture, testing. Certificates: Meta, Google, IBM, AWS, DeepLearning.AI. GitHub: duongthaitan." /></a>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#toolkit"><img src="./assets/keyboard.svg" width="100%" alt="A 3D 75% mechanical keyboard with per-key RGB lighting: a rainbow wave sweeps the legends, the plate and the light bar while it types npm run build, then git push origin main, each key going down as its letter appears. Opens the playable keyboard." /></a>

<img src="./assets/section-divider.svg" width="100%" alt="" />

<a href="https://duongthaitan.github.io/duongthaitan/terminal/"><img src="./assets/galaxy/about.svg" width="100%" alt="$ cat about.md" /></a>

### About

Full-stack developer focused on production-grade web applications and cloud infrastructure. I treat software as a craft: clean architecture, thorough testing and careful design over quick fixes.

Right now I ship TypeScript across the stack, from React frontends to Node.js services backed by PostgreSQL, deployed on AWS. I build systems that are meant to scale and meant to be maintained.

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#toolkit"><img src="./assets/galaxy/toolkit.svg" width="100%" alt="$ ls ~/toolkit/{client,server}" /></a>

### Toolkit

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#toolkit"><img src="./assets/stack-client.svg" width="100%" alt="Client toolkit as 3D keycaps with logos. Languages: TypeScript, JavaScript, Python, Go, Rust. Frontend: React, Next.js, Vue, Tailwind, Three.js. In production now: TypeScript, React. Opens the playable keyboard." /></a>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#toolkit"><img src="./assets/stack-server.svg" width="100%" alt="Server toolkit as 3D keycaps with logos. Backend: Node.js, NestJS, GraphQL. Data: PostgreSQL, MongoDB, Redis. DevOps: Docker, Kubernetes, AWS, GitHub Actions. In production now: Node.js, PostgreSQL, AWS. Opens the playable keyboard." /></a>

<sub>Click either board to press the keys for real.</sub>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#projects"><img src="./assets/galaxy/selected-work.svg" width="100%" alt="$ ls ~/projects" /></a>

### Selected work

<details open>
<summary><code>ls -l ~/projects</code></summary>

| Project | What it is | Stack |
|---------|------------|-------|
| **3D interactive portfolio** | WebGL-powered portfolio with real-time 3D rendering | `Three.js` `React` `GLSL` |
| **Enterprise platform** | Full-stack SaaS platform with multi-tenant architecture | `Next.js` `NestJS` `PostgreSQL` |
| **AI research suite** | ML pipeline orchestration with model training dashboards | `Python` `FastAPI` `PyTorch` |
| **Open source tools** | Developer utilities and CLI tools for workflow automation | `Node.js` `Go` `GitHub Actions` |

</details>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#certificates"><img src="./assets/galaxy/certificates.svg" width="100%" alt="$ cat certificates.json" /></a>

### Certificates

<details open>
<summary><code>cat certificates.json | jq '.[]'</code></summary>

| Certificate | Issuer | Credential |
|-------------|--------|------------|
| Meta Front-End Developer Professional | Meta | [`cert/4tv2o`](https://www.coursera.org/account/accomplishments/professional-cert/4tv2o) |
| Google Cloud Digital Leader | Google | [`cert/d0gj4`](https://www.coursera.org/account/accomplishments/professional-cert/d0gj4) |
| IBM Full Stack Software Developer | IBM | [`cert/kj7vr`](https://www.coursera.org/account/accomplishments/professional-cert/kj7vr) |
| AWS Cloud Solutions Architect | Amazon | [`CT-11PGKZIX`](https://www.credly.com/badges/CT-11PGKZIX) |
| Deep Learning Specialization | DeepLearning.AI | [`CC-USOBZSX7`](https://www.coursera.org/account/accomplishments/specialization/CC-USOBZSX7) |

</details>

<a href="https://github.com/duongthaitan/duongthaitan/actions"><img src="./assets/galaxy/automation.svg" width="100%" alt="$ gh workflow list" /></a>

### Automation

This profile maintains itself. Every visual on the page is an SVG generated from one set of design tokens, and GitHub Actions keeps the numbers current. Click the terminal to watch the runs.

<a href="https://github.com/duongthaitan/duongthaitan/actions"><img src="./assets/terminal-3d.svg" width="100%" alt="A terminal window above a 3D 75% mechanical keyboard with RGB lighting. The keyboard types this repo's pipeline into the terminal key by key: node scripts/gen-profile.mjs lists the generated SVGs and their sizes, node --test scripts/*.test.mjs passes, and git push origin main hands over to GitHub Actions, which keeps the numbers current." /></a>

<details>
<summary><code>cat .github/workflows/*.yml</code> &nbsp;how the pipeline works</summary>

1. **Fetch live metrics** from the GitHub API: public repos, stars and followers.
2. **Render the panel** at the bottom of this page with `scripts/render-metrics.mjs`.
3. **Check every asset.** The test suite rejects scripts, external references and motion without a `prefers-reduced-motion` fallback, and fails if a committed asset drifts from its generator.
4. **Push atomically.** The metrics file updates only when its content changed and the remote SHA still matches.

Artwork comes from `scripts/gen-profile.mjs` and the interactive page from `scripts/gen-site.mjs`, both reading the same facts from `scripts/profile-data.mjs`, with the palette, type and easing curves in `scripts/svg-kit.mjs`. No external image services, no third-party actions.

</details>

<a href="https://duongthaitan.github.io/duongthaitan/terminal/#connect"><img src="./assets/galaxy/connect.svg" width="100%" alt="$ ping duongthaitan" /></a>

### Connect

<a href="https://github.com/duongthaitan"><img src="./assets/ping.svg" width="100%" alt="ping duongthaitan: a realistic Earth built from real geography, turning with sunlit oceans, clouds and a glowing atmosphere, Soc Trang, Vietnam marked, and a reply from github.com/duongthaitan, linkedin.com/in/duongthaitan and @thaitan.duong_." /></a>

<p align="center">
  <a href="https://github.com/duongthaitan"><img src="./assets/keys/github.svg" width="270" alt="github.com/duongthaitan" /></a>
  <a href="https://www.linkedin.com/in/duongthaitan/"><img src="./assets/keys/linkedin.svg" width="270" alt="linkedin.com/in/duongthaitan" /></a>
  <a href="https://www.instagram.com/thaitan.duong_"><img src="./assets/keys/instagram.svg" width="270" alt="@thaitan.duong_ on Instagram" /></a>
</p>

<br/>

<div align="center">
  <a href="https://github.com/duongthaitan?tab=repositories"><img src="./assets/github-metrics.svg" width="100%" alt="Live GitHub metrics. Opens the repositories." /></a>
</div>

<a href="https://github.com/duongthaitan"><img src="./assets/brand.svg" width="100%" alt="tandev, signing off." /></a>

<sub>Icons: <a href="https://phosphoricons.com">Phosphor</a> (MIT). Tool logos: <a href="https://simpleicons.org">Simple Icons</a> (CC0); trademarks belong to their owners.</sub>
