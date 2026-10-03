import { IconWallet, PageTitle } from '../components/Icons'
import { FarmDebtsPanel } from '../features/debts/FarmDebtsPanel'
import {
  FarmDepotPanel,
  FarmEarningsPanel,
} from '../features/warehouse/FarmDepotPanel'
import { useAuth } from '../lib/auth'

export function AssetsPage() {
  const { farmId, user } = useAuth()

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <PageTitle icon={<IconWallet />} tone="olive">
            Varlıklar
          </PageTitle>
          <p className="muted">Depo, satışlar ve borç takibi.</p>
        </div>
      </header>

      {farmId && user && (
        <FarmDepotPanel farmId={farmId} userId={user.uid} />
      )}

      {farmId && <FarmEarningsPanel farmId={farmId} />}

      {farmId && user && (
        <FarmDebtsPanel farmId={farmId} userId={user.uid} />
      )}
    </div>
  )
}
