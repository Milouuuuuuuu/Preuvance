# Recherche préalable — 13 juillet 2026

## Nom et domaines

Le nom **Aplomb** est écarté :

- [`aplomb.app`](https://aplomb.app/lander) est enregistré et parqué ;
- [`getaplomb.com`](https://getaplomb.com/) est exploité par une marque américaine ;
- [`aplomb.eu`](https://aplomb.eu/) est enregistré et proposé à la vente ;
- [Aplomb Strategies](https://aplombstrategies.com/) intervient directement en gouvernance des technologies émergentes, IA, réglementation et gestion des risques.

Le choix de travail est **Preuvance**. Les signaux RDAP observés pour `.com`, `.app` et `.fr` étaient libres au moment de la recherche. Ils ne remplacent ni un achat immédiat chez un registrar, ni une recherche d’antériorités [EUIPO](https://euipo.europa.eu/eSearch/), [TMview](https://www.tmdn.org/tmview/) et [OMPI](https://branddb.wipo.int/).

## Concurrence

Le produit ne prétend plus être le premier pont entre IA et assurance : [Armilla](https://www.armilla.ai/), [Munich Re aiSure](https://www.munichre.com/en/solutions/for-industry-clients/insure-ai.html) et [Insured AI](https://insuredai.ca/) couvrent déjà une partie de cette chaîne.

Le positionnement retenu est plus précis : transformer une description libre en français en dossier daté et traçable de préparation courtier, pour PME/SMC européennes.

## Cadre réglementaire

Sources primaires :

- [Règlement (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)
- [Texte final de l’Omnibus signé le 8 juillet 2026](https://data.consilium.europa.eu/doc/document/PE-30-2026-REV-1/en/pdf)
- [Adoption finale du Conseil](https://www.consilium.europa.eu/en/press/press-releases/2026/06/29/artificial-intelligence-council-gives-final-green-light-to-simplify-and-streamline-rules/)
- [Procédure législative du Parlement](https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2025%2F0359%28COD%29)
- [Définition officielle des SMC](https://eur-lex.europa.eu/eli/reco/2025/1099/oj/eng)
- [Calendrier GPAI de la Commission](https://digital-strategy.ec.europa.eu/en/policies/guidelines-gpai-providers)

Conclusion au 13/07/2026 : l’Omnibus est adopté et signé mais attend sa publication au JOUE. Les dates qu’il prévoit sont montrées comme scénario futur ; les dates du règlement 2024/1689 restent le droit contraignant jusqu’à l’entrée en vigueur de l’Omnibus.

## API OpenAI

- [`gpt-5.6-sol`](https://developers.openai.com/api/docs/models/gpt-5.6-sol) : raisonnement principal.
- [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) : voie économique après évaluations.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) : JSON Schema strict.
- [Streaming Responses](https://developers.openai.com/api/docs/guides/streaming-responses) : événements sémantiques et résultat final validé.

Les identifiants restent configurables par variables d’environnement et l’accès réel doit être vérifié avec le projet API cible.
