export const agents = Object.freeze([
  { id: 'owner', name: 'Olga', role: 'Owner', function: 'Wybiera zakres prac i termin wydania.' },
  { id: 'lead', name: 'Leon', role: 'Lead', function: 'Koordynuje pracę i aktualizuje zadania.' },
  { id: 'product', name: 'Patrycja', role: 'Product', function: 'Definiuje wymagania i kryteria akceptacji.' },
  { id: 'architect', name: 'Adrian', role: 'Architect', function: 'Sprawdza projekt rozwiązania i jego zgodność z kodem.' },
  { id: 'developer', name: 'Daniel', role: 'Developer', function: 'Implementuje i poprawia kod aplikacji.' },
  { id: 'ux', name: 'Urszula', role: 'UX', function: 'Ocenia układ i użyteczność interfejsu.' },
  { id: 'process-engineer', name: 'Piotr', role: 'Process engineer', function: 'Ocenia analizy statystyczne, wykresy, jednostki i prezentację wyników.' },
  { id: 'tester', name: 'Tomasz', role: 'Tester', function: 'Dopisuje testy w tests/tester i weryfikuje działanie.' },
  { id: 'security', name: 'Sara', role: 'Security', function: 'Sprawdza import, przechowywanie danych, sieć i wdrożenie.' },
  { id: 'maintainer', name: 'Marta', role: 'Maintainer', function: 'Aktualizuje wersję, changelog i instrukcje wdrożenia.' }
]);

export const agentByRole = new Map(agents.map((agent) => [agent.id, agent]));
