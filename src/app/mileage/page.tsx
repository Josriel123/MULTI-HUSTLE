'use client';

import { useCallback } from 'react';
import { Car } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { MileageSection } from '@/components/MileageSection';
import { errorText, fetchHustles, fetchMileage, fetchSummary } from '@/components/api';
import { useLoad } from '@/components/useLoad';
import { useTaxYear } from '@/components/useTaxYear';
import { Busy } from '@/components/ui/Busy';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';

const loadHustles = () => fetchHustles();

/** Business mileage. The trip log comes from /api/mileage; what was deducted comes from the estimate. */
export default function MileagePage() {
  const [taxYear] = useTaxYear();
  const key = String(taxYear ?? 'default');
  const loadMileage = useCallback(() => fetchMileage(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const mileage = useLoad(key, loadMileage);
  const summary = useLoad(key, loadSummary);
  const hustles = useLoad('hustles', loadHustles);

  const reloadMileage = mileage.reload;
  const reloadSummary = summary.reload;
  const refresh = useCallback(async () => {
    await Promise.allSettled([reloadMileage(), reloadSummary()]);
  }, [reloadMileage, reloadSummary]);

  const data = summary.data;
  const error = mileage.error ?? summary.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mileage"
        description="Driving for your hustles is deductible at the IRS standard rate. Log each business trip and the estimate prices it for you."
        icon={<Car size={22} />}
        iconTone="accent"
      />
      {error !== null && <InlineStatus kind="error">{errorText(error, 'Could not load your mileage.')}</InlineStatus>}
      <Busy busy={mileage.loading && mileage.data !== null}>
        <MileageSection
          logs={mileage.data?.logs ?? []}
          totalMiles={mileage.data?.totalMiles ?? '0'}
          ratePeriods={mileage.data?.ratePeriods ?? []}
          vehicle={data?.estimate.scheduleC.mileage ?? null}
          hustles={hustles.data ?? []}
          taxYear={mileage.data?.taxYear ?? taxYear}
          onRefresh={refresh}
        />
      </Busy>
      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} />}
    </div>
  );
}
