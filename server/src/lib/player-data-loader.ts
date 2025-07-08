import fs from 'fs/promises';
import path from 'path';

export interface PlayerData {
  name: string;
  content: string;
}

export async function loadAllPlayerData(): Promise<PlayerData[]> {
  const dataDir = path.join(process.cwd(), 'data');
  
  try {
    const files = await fs.readdir(dataDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    const playerData = await Promise.all(
      markdownFiles.map(async (file) => {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = file.replace('.md', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return {
          name,
          content
        };
      })
    );
    
    return playerData;
  } catch (error) {
    console.error('Error loading player data:', error);
    return [];
  }
}

export async function formatPlayerDataForPrompt(): Promise<string> {
  const playerData = await loadAllPlayerData();
  
  if (playerData.length === 0) {
    return '';
  }
  
  let prompt = '\n\n## Player Data Files\n\n';
  
  for (const player of playerData) {
    prompt += `### ${player.name}\n\n`;
    prompt += player.content;
    prompt += '\n\n---\n\n';
  }
  
  return prompt;
}