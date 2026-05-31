/**
 * RequestReviewButton — one-tap "Pedir reseña" action.
 *
 * Opens the shared SendDocumentDialog (WhatsApp / SMS / Email) pre-filled with
 * the contractor's public review landing link (/r/:card_slug). If the user has
 * not configured their Google Reviews link yet, it nudges them to /reviews
 * instead of sharing a broken link.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import SendDocumentDialog from "@/components/SendDocumentDialog";

export default function RequestReviewButton({
  client,
  jobTitle,
  className = "",
  size = "default",
  label = "Pedir reseña",
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const reviewUrl = user?.card_slug
    ? `${window.location.origin}/r/${user.card_slug}`
    : "";

  const handleClick = () => {
    if (!user?.google_review_url) {
      toast.error("Primero configura tu link de Google Reviews", {
        action: { label: "Configurar", onClick: () => navigate("/reviews") },
      });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        data-testid="request-review-btn"
        onClick={handleClick}
        size={size}
        className={`bg-yellow-500 hover:bg-yellow-600 text-white ${className}`}
      >
        <Star className="w-4 h-4 mr-1 flex-shrink-0 fill-white" /> {label}
      </Button>

      <SendDocumentDialog
        open={open}
        onClose={() => setOpen(false)}
        kind="review"
        publicUrl={reviewUrl}
        client={client}
        businessName={user?.business_name}
        jobTitle={jobTitle}
      />
    </>
  );
}
