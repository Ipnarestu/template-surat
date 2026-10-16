/* eslint-disable @typescript-eslint/no-explicit-any */
import { UseFormReturn } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/feedback/form'
import { Input } from '.'
import { ReactNode } from 'react'
import clsx from 'clsx'
import { showWarning } from '@/utils/notifications'
import { Image, Loader } from 'lucide-react'

export function InputFile({
  form,
  urls,
  isLoading,
  loadingFile,
  handleUploadFoto,
  label,
  name,
  isDisabled,
  isShowLabel = true,
  acceptedInput = 'image/*',
  inputForm,
  imageForm,
  handleUploadMultiFoto,
  index,
  handleUploadFotoWithName,
}: {
  form: UseFormReturn | undefined | any
  urls: string
  isLoading: boolean
  loadingFile: boolean
  name: string
  label?: string
  handleUploadFoto?: (file: File) => Promise<void>
  handleUploadFotoWithName?: (file: File, name: string) => Promise<void>
  handleUploadMultiFoto?: (file: File, index: number) => Promise<void>
  isDisabled?: boolean
  isShowLabel?: boolean
  acceptedInput?: string
  inputForm?: ReactNode
  imageForm: ReactNode
  index?: number
}) {
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-12">
          <FormControl>
            <div>
              <Input
                className="-z-[1] h-[0.1px] w-[0.1px] overflow-hidden opacity-0"
                {...field}
                id={`file_${name}`}
                type="file"
                value={''}
                accept={acceptedInput}
                disabled={isLoading || loadingFile || isDisabled}
                placeholder="Lampiran"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1000000) {
                    void showWarning('Ukuran file terlalu besar', 'Pilih file dengan ukuran maksimal 5 MB.')
                    return
                  } else {
                    if (handleUploadFoto) {
                      handleUploadFoto(file)
                    } else if (handleUploadFotoWithName) {
                      handleUploadFotoWithName(file, name)
                    } else if (
                      handleUploadMultiFoto
                    ) {
                      handleUploadMultiFoto(file, index ?? 0)
                    }
                  }
                }}
              />
              <div className="flex flex-col gap-12 phones:flex-col">
                <label
                  className="flex flex-col gap-12"
                  htmlFor={`file_${name}`}
                >
                  {isShowLabel && (
                    <p className="text-app-primary">{label ?? 'Berkas'}</p>
                  )}
                  <div className="flex">
                    {urls
                      ? imageForm
                      : (inputForm ?? (
                          <div
                            className={clsx(
                              'flex items-center gap-12 rounded-2xl border p-12 hover:cursor-pointer hover:bg-opacity-80',
                              {
                                'bg-warna-dark border-transparent text-white':
                                  urls,
                                'text-warna-dark border-portal-paleBlue': !urls,
                              },
                            )}
                          >
                            {loadingFile ? (
                              <span className="animate-spin duration-300">
                                <Loader size={16} />
                              </span>
                            ) : (
                              <Image />
                            )}
                            <p className="text-[1.6rem] uppercase tracking-1.25">
                              {urls === undefined ||
                              urls === '' ||
                              urls === null
                                ? 'Unggah'
                                : 'Ganti'}
                            </p>
                          </div>
                        ))}
                  </div>
                </label>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
