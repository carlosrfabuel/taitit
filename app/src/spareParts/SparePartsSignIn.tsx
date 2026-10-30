import { SignedOutPage } from '@/auth/SignedOutPage';

/** What a guest sees on any spare parts page (the tab, or one opened by its address). */
export function SparePartsSignIn() {
  return (
    <SignedOutPage
      icon="construct-outline"
      title="Spare parts"
      message="Sign in to request spare parts for your frames."
      heading="Spare parts"
      intro="Request a replacement front or temple for your TAITIT frames. The warehouse or your sales rep then contacts you about it."
      steps={[
        { icon: 'glasses-outline', title: 'Choose the model', text: 'Any frame in the catalog.' },
        { icon: 'extension-puzzle-outline', title: 'Pick the part', text: 'The front or a temple.' },
        { icon: 'camera-outline', title: 'Add 3 photos', text: 'From different angles, with a note.' },
      ]}
    />
  );
}
