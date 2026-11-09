// Facts about the profile, shared by the README artwork (gen-profile.mjs) and the interactive
// terminal page (gen-site.mjs), so the two can never disagree. Every value here is taken from the
// README; nothing is invented. ASCII only.

export const PROFILE = {
  name: 'Duong Thai Tan',
  handle: 'duongthaitan',
  role: 'full-stack developer',
  roles: ['full-stack developer', 'cloud infrastructure builder', 'visual creator'],
  location: 'Soc Trang, Vietnam',
  line: 'I build web apps and the cloud systems that run them.',
  about: [
    'Full-stack developer focused on production-grade web applications and cloud infrastructure. I treat software as a craft: clean architecture, thorough testing and careful design over quick fixes.',
    'Right now I ship TypeScript across the stack, from React frontends to Node.js services backed by PostgreSQL, deployed on AWS. I build systems that are meant to scale and meant to be maintained.',
  ],
};

export const NEOFETCH = [
  ['role', 'full-stack developer'],
  ['location', 'soc trang, vietnam'],
  ['shipping', 'typescript across the stack'],
  ['stack', 'react, node.js, postgresql, aws'],
  ['focus', 'clean architecture, testing'],
  ['certs', 'meta, google, ibm, aws, deeplearning.ai'],
  ['github', 'duongthaitan'],
];

export const STACK = [
  ['languages', ['typescript', 'javascript', 'python', 'go', 'rust']],
  ['frontend', ['react', 'next.js', 'vue', 'tailwind', 'three.js']],
  ['backend', ['node.js', 'nestjs', 'graphql']],
  ['data', ['postgresql', 'mongodb', 'redis']],
  ['devops', ['docker', 'kubernetes', 'aws', 'github actions']],
];

// From the About copy: what is in production right now.
export const CURRENT = new Set(['typescript', 'react', 'node.js', 'postgresql', 'aws']);

// Tool name -> Simple Icons slug in tool-icons.mjs.
export const SLUGS = {
  typescript: 'typescript', javascript: 'javascript', python: 'python', go: 'go', rust: 'rust',
  react: 'react', 'next.js': 'nextdotjs', vue: 'vuedotjs', tailwind: 'tailwindcss', 'three.js': 'threedotjs',
  'node.js': 'nodedotjs', nestjs: 'nestjs', graphql: 'graphql', postgresql: 'postgresql', mongodb: 'mongodb',
  redis: 'redis', docker: 'docker', kubernetes: 'kubernetes', aws: 'amazonwebservices', 'github actions': 'githubactions',
};

export const PROJECTS = [
  { name: '3D interactive portfolio', what: 'WebGL-powered portfolio with real-time 3D rendering', stack: ['Three.js', 'React', 'GLSL'] },
  { name: 'Enterprise platform', what: 'Full-stack SaaS platform with multi-tenant architecture', stack: ['Next.js', 'NestJS', 'PostgreSQL'] },
  { name: 'AI research suite', what: 'ML pipeline orchestration with model training dashboards', stack: ['Python', 'FastAPI', 'PyTorch'] },
  { name: 'Open source tools', what: 'Developer utilities and CLI tools for workflow automation', stack: ['Node.js', 'Go', 'GitHub Actions'] },
];

export const CERTS = [
  { name: 'Meta Front-End Developer Professional', issuer: 'Meta', id: 'cert/4tv2o', url: 'https://www.coursera.org/account/accomplishments/professional-cert/4tv2o' },
  { name: 'Google Cloud Digital Leader', issuer: 'Google', id: 'cert/d0gj4', url: 'https://www.coursera.org/account/accomplishments/professional-cert/d0gj4' },
  { name: 'IBM Full Stack Software Developer', issuer: 'IBM', id: 'cert/kj7vr', url: 'https://www.coursera.org/account/accomplishments/professional-cert/kj7vr' },
  { name: 'AWS Cloud Solutions Architect', issuer: 'Amazon', id: 'CT-11PGKZIX', url: 'https://www.credly.com/badges/CT-11PGKZIX' },
  { name: 'Deep Learning Specialization', issuer: 'DeepLearning.AI', id: 'CC-USOBZSX7', url: 'https://www.coursera.org/account/accomplishments/specialization/CC-USOBZSX7' },
];

export const LINKS = [
  { where: 'github', label: 'github.com/duongthaitan', url: 'https://github.com/duongthaitan' },
  { where: 'linkedin', label: 'linkedin.com/in/duongthaitan', url: 'https://www.linkedin.com/in/duongthaitan/' },
  { where: 'instagram', label: '@thaitan.duong_', url: 'https://www.instagram.com/thaitan.duong_' },
];

// Where the interactive page is published (GitHub Pages for this repository).
export const SITE_URL = 'https://duongthaitan.github.io/duongthaitan/terminal/';

// The <T/> mark, 5x7 per glyph: the README voxel sculpture and the terminal's neofetch art.
export const GLYPHS = {
  '<': ['....#', '...#.', '..#..', '.#...', '..#..', '...#.', '....#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '>': ['#....', '.#...', '..#..', '...#.', '..#..', '.#...', '#....'],
};
