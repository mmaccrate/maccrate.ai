// src/types/content.ts
// Content configuration mapping instruments to portfolio sections

export type ContentType = 'essay' | 'demo' | 'placeholder';

export interface ContentConfig {
  type: ContentType;
  title: string;
  description: string;
  icon: string;
  url?: string;
  status: 'live' | 'coming-soon' | 'empty';
}

/**
 * Complete mapping of all 17 instruments to their content
 */
export const CONTENT_MAPPING: Record<string, ContentConfig> = {
  // ============================================
  // REEDS SECTION (5 saxophones)
  // ============================================
  
  // Alto Sax 1 - Agent Orchestration Essay (LIVE)
  'alto-sax-1': {
    type: 'essay',
    title: 'Agent Orchestration',
    description: 'How we coordinate multiple AI agents for complex workflows. Learn about our agent communication patterns and task distribution system.',
    icon: '📄',
    url: '/essay/agent-orchestration',
    status: 'live'
  },
  
  // Alto Sax 2 - Multi-Agent Coordination (EMPTY)
  'alto-sax-2': {
    type: 'placeholder',
    title: 'Multi-Agent Coordination',
    description: 'Placeholder: Patterns for coordinating multiple specialized agents. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },
  
  // Tenor Sax 1 - Allergen Graph Demo (LIVE)
  'tenor-sax-1': {
    type: 'demo',
    title: 'Allergen Graph Demo',
    description: 'Interactive visualization of food allergen relationships. Explore how knowledge graphs can represent complex food safety data.',
    icon: '🔬',
    url: '/demo/allergen-graph',
    status: 'live'
  },
  
  // Tenor Sax 2 - Agent Scaling (COMING SOON)
  'tenor-sax-2': {
    type: 'placeholder',
    title: 'Agent Scaling Patterns',
    description: 'Coming soon: Techniques for scaling agent workflows across domains and organizations.',
    icon: '📈',
    status: 'coming-soon'
  },
  
  // Baritone Sax - Agent Foundations (EMPTY)
  'baritone-sax': {
    type: 'placeholder',
    title: 'Agent Foundations',
    description: 'Placeholder: The architectural foundations of autonomous agent systems. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },

  // ============================================
  // BRASS SECTION - TROMBONES (4)
  // ============================================
  
  // Trombone 1 - System Architecture (LIVE)
  'trombone-1': {
    type: 'essay',
    title: 'System Architecture',
    description: 'The Ensemble: Our approach to system design and architectural patterns. Learn how we build scalable, maintainable systems.',
    icon: '🏗️',
    url: '/essay/system-architecture',
    status: 'live'
  },
  
  // Trombone 2 - Data Visualization (EMPTY)
  'trombone-2': {
    type: 'placeholder',
    title: 'Data Visualization',
    description: 'Placeholder: Advanced techniques for visualizing complex datasets. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },
  
  // Trombone 3 - Data Pipeline (COMING SOON)
  'trombone-3': {
    type: 'placeholder',
    title: 'Data Pipeline Demo',
    description: 'Coming soon: Real-time data processing and transformation pipelines.',
    icon: '🔄',
    status: 'coming-soon'
  },
  
  // Trombone 4 - Distributed Systems (EMPTY)
  'trombone-4': {
    type: 'placeholder',
    title: 'Distributed Systems',
    description: 'Placeholder: Architecture patterns for distributed computing. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },

  // ============================================
  // BRASS SECTION - TRUMPETS (4)
  // ============================================
  
  // Trumpet 1 - Real-time Sync (COMING SOON)
  'trumpet-1': {
    type: 'placeholder',
    title: 'Real-time Sync Demo',
    description: 'Coming soon: Real-time synchronization patterns for distributed applications.',
    icon: '⚡',
    status: 'coming-soon'
  },
  
  // Trumpet 2 - API Gateway (EMPTY)
  'trumpet-2': {
    type: 'placeholder',
    title: 'API Gateway',
    description: 'Placeholder: API gateway design patterns and implementation strategies. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },
  
  // Trumpet 3 - Event Streaming (COMING SOON)
  'trumpet-3': {
    type: 'placeholder',
    title: 'Event Streaming Demo',
    description: 'Coming soon: Event-driven architecture and streaming data patterns.',
    icon: '📡',
    status: 'coming-soon'
  },
  
  // Trumpet 4 - Microservices (EMPTY)
  'trumpet-4': {
    type: 'placeholder',
    title: 'Microservices',
    description: 'Placeholder: Microservices architecture patterns and best practices. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },

  // ============================================
  // RHYTHM SECTION (4 instruments)
  // ============================================
  
  // Piano - Memory Systems (LIVE)
  'piano': {
    type: 'essay',
    title: 'Memory Systems',
    description: 'Persistent memory architecture for long-context AI agents. How we enable agents to remember and learn over time.',
    icon: '🧠',
    url: '/essay/memory-systems',
    status: 'live'
  },
  
  // Bass - Persistence Layer (EMPTY)
  'bass': {
    type: 'placeholder',
    title: 'Persistence Layer',
    description: 'Placeholder: Database and persistence patterns for agent memory. Coming soon.',
    icon: '🔲',
    status: 'empty'
  },
  
  // Drums - Performance Metrics (COMING SOON)
  'drums': {
    type: 'placeholder',
    title: 'Performance Metrics Demo',
    description: 'Coming soon: Real-time performance monitoring and metrics visualization.',
    icon: '📊',
    status: 'coming-soon'
  },
  
  // Guitar - Edge Computing (EMPTY)
  'guitar': {
    type: 'placeholder',
    title: 'Edge Computing',
    description: 'Placeholder: Edge computing patterns for distributed AI inference. Coming soon.',
    icon: '🔲',
    status: 'empty'
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get content config for an instrument
 */
export const getContentConfig = (instrumentId: string): ContentConfig | null => {
  return CONTENT_MAPPING[instrumentId] || null;
};

/**
 * Get all instruments that have content
 */
export const getInstrumentsWithContent = (): string[] => {
  return Object.keys(CONTENT_MAPPING);
};

/**
 * Check if an instrument has content
 */
export const hasContent = (instrumentId: string): boolean => {
  return instrumentId in CONTENT_MAPPING;
};

/**
 * Get instruments by content type
 */
export const getInstrumentsByContentType = (type: ContentType): string[] => {
  return Object.entries(CONTENT_MAPPING)
    .filter(([_, config]) => config.type === type)
    .map(([id, _]) => id);
};

/**
 * Get instruments by status
 */
export const getInstrumentsByStatus = (status: ContentConfig['status']): string[] => {
  return Object.entries(CONTENT_MAPPING)
    .filter(([_, config]) => config.status === status)
    .map(([id, _]) => id);
};

/**
 * Get content statistics
 */
export const getContentStats = () => {
  const stats = {
    essays: 0,
    demos: 0,
    placeholders: 0,
    live: 0,
    'coming-soon': 0,
    empty: 0,
    total: Object.keys(CONTENT_MAPPING).length
  };

  Object.values(CONTENT_MAPPING).forEach(config => {
    if (config.type === 'essay') stats.essays++;
    else if (config.type === 'demo') stats.demos++;
    else stats.placeholders++;

    if (config.status === 'live') stats.live++;
    else if (config.status === 'coming-soon') stats['coming-soon']++;
    else stats.empty++;
  });

  return stats;
};
