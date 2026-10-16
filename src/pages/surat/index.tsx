import { DialogCustom } from '@/components/feedback/dialogComponents'
import { ListSurat } from '@/components/feedback/selectComponents/selectDummy'
import { useMobile } from '@/hooks/useMobile'
import { usePathname } from '@/hooks/usePathname'
import { convertToSlug } from '@/utils/formatText'
import clsx from 'clsx'
import { Filter } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

export default function SuratPage() {
  const { lastPathname } = usePathname()
  const { isMobile } = useMobile()
  const navigate = useNavigate()
  const { secondPathname } = usePathname()

  const [isShow, setIsShow] = useState<boolean>(false)

  return (
    <div className="scrollbar flex h-full min-w-0 flex-col gap-24 overflow-auto">
      <div className="scrollbar flex w-full min-w-0 max-w-full items-center gap-12 overflow-hidden">
        <div className="scrollbar flex min-w-0 flex-1 items-center gap-12 overflow-x-auto">
          {ListSurat?.map((item, idx) => {
            return (
              <div
                onClick={() => {
                  navigate(`/surat/${convertToSlug(item?.nama)}`)
                }}
                className={clsx(
                  'flex items-center gap-8 rounded-xl bg-[#f3f4f6] p-16 text-[#374151] hover:cursor-pointer',
                  {
                    'bg-gray-500 text-gray-100':
                      secondPathname === convertToSlug(item?.nama),
                    'transition-all duration-300 hover:bg-gray-500 hover:text-gray-100':
                      secondPathname !== convertToSlug(item?.nama),
                  },
                )}
                key={idx}
              >
                  <item.icon aria-hidden="true" size={18} className="shrink-0" />
                <p className="text-nowrap">{item?.nama}</p>
              </div>
            )
          })}
        </div>
        <div
          onClick={() => setIsShow(true)}
          className="flex shrink-0 cursor-pointer items-center gap-12 rounded-2xl border border-gray-500 px-16 py-12 text-gray-500 transition-all duration-300 hover:bg-gray-500 hover:text-white"
        >
          <Filter size={16} />
          <p>Filter</p>
        </div>
      </div>
      <div className="scrollbar flex h-full w-full flex-1 overflow-auto">
        <Outlet />
      </div>

      <DialogCustom
        isOpen={isShow}
        setIsOpen={setIsShow}
        isMobile={isMobile}
        headerTitle={
          <p className="border-b pb-16 text-left text-[2.8rem] font-bold">
            Pilih Surat
          </p>
        }
        width="60%"
        textContent={
          <div className="grid w-full grid-cols-3 gap-32 font-sans text-[2rem] phones:grid-cols-1">
            <div className="col-span-1 flex flex-col gap-24">
              <p className="text-[2.2rem] font-medium">
                Surat Bisnis & Komunikasi Resmi
              </p>
              <div className="flex flex-col gap-4 leading-[1.3]">
                {[
                  'Surat Penawaran',
                  'Surat Permintaan Barang',
                  'Surat Pesanan',
                ]?.map((item, idx) => (
                  <div
                    onClick={() => {
                      setIsShow(false)
                      navigate(`/surat/${convertToSlug(item)}`)
                    }}
                    className={clsx(
                      'cursor-pointer p-12 transition-colors duration-300',
                      {
                        'rounded-lg bg-slate-700 text-slate-100':
                          lastPathname === convertToSlug(item),
                        'hover:bg-slate-50':
                          lastPathname !== convertToSlug(item),
                      },
                    )}
                    key={idx}
                  >
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-1 flex flex-col gap-24">
              <p className="text-[2.2rem] font-medium">
                Surat Legal & Perjanjian
              </p>
              <div className="flex flex-col gap-4 leading-[1.3]">
                {[
                  'Surat Perjanjian Jual Beli',
                ]?.map((item, idx) => (
                  <div
                    onClick={() => {
                      setIsShow(false)
                      navigate(`/surat/${convertToSlug(item)}`)
                    }}
                    className={clsx(
                      'cursor-pointer p-12 transition-colors duration-300',
                      {
                        'rounded-lg bg-slate-700 text-slate-100':
                          lastPathname === convertToSlug(item),
                        'hover:bg-slate-50':
                          lastPathname !== convertToSlug(item),
                      },
                    )}
                    key={idx}
                  >
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
