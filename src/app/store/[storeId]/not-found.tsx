import { StoreNotFoundMessage } from "./StoreStatusMessages";

export default function NotFound() {
  return <StoreNotFoundMessage backToSearchHref="/search" />;
}
