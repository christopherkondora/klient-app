import { useParams, useNavigate } from 'react-router-dom';
import { useAds } from '../contexts/AdsContext';
import AdsCampaignView from '../components/AdsCampaignView';
import { Loader2, Megaphone } from 'lucide-react';

function AdsCampaignDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedAccount } = useAds();

  if (!selectedAccount) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal" />
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Megaphone className="w-8 h-8 text-steel/20" />
      </div>
    );
  }

  return (
    <AdsCampaignView
      accountId={selectedAccount.id}
      campaignId={id}
      onBack={() => navigate('/ads/campaigns')}
    />
  );
}

export default function AdsCampaignDetail() {
  return <AdsCampaignDetailContent />;
}
