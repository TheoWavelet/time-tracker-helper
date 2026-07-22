import type { TagDTO } from '@shared/types';
export declare function listTags(): TagDTO[];
export declare function findTagByLabel(label: string): TagDTO | null;
export declare function findOrCreateTagByLabel(label: string): TagDTO;
