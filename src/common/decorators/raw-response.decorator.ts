import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'response:raw';

/** Click/Payme kabi tashqi provayderlar javobni o'z protokol shaklida kutadi — umumiy {success,data} qobig'i o'ralmaydi. */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
