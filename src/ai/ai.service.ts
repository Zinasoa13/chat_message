// src/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    this.genAI = new GoogleGenerativeAI(this.configService.get<string>('GEMINI_API_KEY')!);
  }

  async generateReport(topic: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Utilisation d'un modèle plus récent si possible, ou rester sur flash

    const prompt = `
      Tu es un assistant de rédaction de rapports professionnels.
      Rédige un rapport structuré et bien présenté sur le sujet suivant : "${topic}".

      Instructions de formatage :
      1. Utilise un titre clair en majuscules au début.
      2. Divise le rapport en sections logiques (ex: Introduction, Analyse, Recommandations, Conclusion).
      3. Utilise des puces (•) pour les listes.
      4. Ajoute des sauts de ligne doubles entre les paragraphes et les sections pour la lisibilité.
      5. Pas besoin de symboles Markdown complexes comme des blocs de code, garde un style texte riche mais propre.
      6. Le ton doit être professionnel et concis.

      Rapport :
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();

    // Petit nettoyage pour s'assurer que c'est propre
    text = text.trim();
    // On remplace les suites de plus de 2 sauts de ligne par juste 2
    text = text.replace(/\n{3,}/g, '\n\n');

    console.log('Rapport généré et formaté');
    return text;
  }
}