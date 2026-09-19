/**
 * The three canonical sample enquiries. They run in the UI (Task 6) and are
 * the first three eval cases (Task 8) so demo and evals can never diverge.
 * Expected extractions per docs/roopac-research.md §2–§3 fixtures.
 */

export interface Fixture {
  id: string;
  label: string;
  message: string;
}

export const FIXTURES: Fixture[] = [
  {
    id: "english-boutique",
    label: "English",
    message:
      "Hi, opening a saree boutique in Coimbatore next month. Need around 500 premium carry bags with my logo, 2 colours. Can you share options? Also what details do you need from me?",
  },
  {
    id: "tamil",
    label: "Tamil",
    message:
      "வணக்கம், எனக்கு கோவையில் புதிய சேலை கடை திறக்கப் போகுது. அதுக்கு 500 பேப்பர் பேக் வேணும், லோகோ அட்டச் பண்ணிட்டேன். விலை என்ன?",
  },
  {
    id: "tanglish",
    label: "Tanglish",
    message: "Anna enaku 500 paper bag venum, boutique ku, logo iruku. Chennai la shop. Evalo naal aagum?",
  },
];
