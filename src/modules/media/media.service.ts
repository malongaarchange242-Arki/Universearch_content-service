// src/modules/media/media.service.ts (extension du service existant)

import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Configurer FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class MediaService {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Normalise une vidéo en MP4 H.264/AAC pour compatibilité mobile
   */
  async normalizeVideo(inputBuffer: Buffer, originalFilename: string): Promise<Buffer> {
    const tempInputPath = `/tmp/${randomUUID()}_${originalFilename}`;
    const tempOutputPath = `/tmp/${randomUUID()}_normalized.mp4`;

    // Écrire le buffer d'entrée dans un fichier temporaire
    require('fs').writeFileSync(tempInputPath, inputBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .inputOptions(['-hwaccel auto']) // Accélération matérielle si disponible
        .outputOptions([
          '-c:v libx264', // Codec vidéo H.264
          '-preset fast', // Preset rapide pour production
          '-crf 23', // Qualité équilibrée (plus bas = meilleure qualité)
          '-c:a aac', // Codec audio AAC
          '-b:a 128k', // Bitrate audio
          '-movflags +faststart', // Optimisé pour streaming (moov atom au début)
          '-pix_fmt yuv420p', // Format pixel compatible mobile
          '-vf scale=-2:720', // Redimensionner à 720p max (optionnel, ajustez selon besoin)
        ])
        .output(tempOutputPath)
        .on('end', () => {
          const outputBuffer = require('fs').readFileSync(tempOutputPath);
          // Nettoyer les fichiers temporaires
          require('fs').unlinkSync(tempInputPath);
          require('fs').unlinkSync(tempOutputPath);
          resolve(outputBuffer);
        })
        .on('error', (err: any) => {
          // Nettoyer en cas d'erreur
          try { require('fs').unlinkSync(tempInputPath); } catch {}
          try { require('fs').unlinkSync(tempOutputPath); } catch {}
          reject(new Error(`FFmpeg normalization failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Upload une vidéo normalisée vers Supabase Storage
   */
  async uploadNormalizedVideo(buffer: Buffer, filename: string): Promise<string> {
    const uuid = randomUUID();
    const filePath = `videos/${uuid}.mp4`;

    const { data, error } = await this.supabase.storage
      .from('videos')
      .upload(filePath, buffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: publicUrl } = this.supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    return publicUrl.publicUrl;
  }

  /**
   * Pipeline complète : Normaliser + Upload
   */
  async processAndUploadVideo(inputBuffer: Buffer, originalFilename: string): Promise<string> {
    const normalizedBuffer = await this.normalizeVideo(inputBuffer, originalFilename);
    return this.uploadNormalizedVideo(normalizedBuffer, originalFilename);
  }
}

// Exemple d'utilisation dans posts.controller.ts
// import { MediaService } from '../media/media.service';
// const mediaService = new MediaService(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// const mediaUrl = await mediaService.processAndUploadVideo(buffer, filename);