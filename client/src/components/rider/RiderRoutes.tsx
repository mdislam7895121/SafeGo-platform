import { Switch, Route, Redirect } from "wouter";
import { RideBookingProvider } from "@/contexts/RideBookingContext";
import { RiderLayout } from "@/layouts/RiderLayout";

import RiderHome from "@/pages/rider/home";
import RiderTrips from "@/pages/rider/trips";
import RiderOrders from "@/pages/rider/orders";
import RiderParcels from "@/pages/rider/parcels";
import RiderWallet from "@/pages/rider/wallet";
import RiderSupport from "@/pages/rider/support";
import RiderAccount from "@/pages/rider/account";
import RiderSettings from "@/pages/rider/settings";
import RideNew from "@/pages/rider/ride/new";
import RidePickup from "@/pages/rider/ride/pickup";
import RideDropoff from "@/pages/rider/ride/dropoff";
import RideOptions from "@/pages/rider/ride/options";
import RideConfirm from "@/pages/rider/ride/confirm";
import RiderTripActive from "@/pages/rider/trip/active";
import RiderTripReceipt from "@/pages/rider/trip/receipt";

export function RiderRoutes() {
  return (
    <RideBookingProvider>
      <Switch>
        <Route path="/rider" component={() => <Redirect to="/rider/home" />} />
        
        <Route path="/rider/home">
          <RiderLayout pageTitle="Home">
            <RiderHome />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/trips/:id">
          <RiderLayout pageTitle="Trip Details">
            <RiderTrips />
          </RiderLayout>
        </Route>
        <Route path="/rider/trips">
          <RiderLayout pageTitle="Rides">
            <RiderTrips />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/orders/:id">
          <RiderLayout pageTitle="Order Details">
            <RiderOrders />
          </RiderLayout>
        </Route>
        <Route path="/rider/orders">
          <RiderLayout pageTitle="Food Orders">
            <RiderOrders />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/parcels/:id">
          <RiderLayout pageTitle="Parcel Details">
            <RiderParcels />
          </RiderLayout>
        </Route>
        <Route path="/rider/parcels">
          <RiderLayout pageTitle="Parcels">
            <RiderParcels />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/wallet/methods">
          <RiderLayout pageTitle="Payment Methods">
            <RiderWallet />
          </RiderLayout>
        </Route>
        <Route path="/rider/wallet/history">
          <RiderLayout pageTitle="Transaction History">
            <RiderWallet />
          </RiderLayout>
        </Route>
        <Route path="/rider/wallet">
          <RiderLayout pageTitle="Wallet">
            <RiderWallet />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/promotions">
          <RiderLayout pageTitle="Promotions">
            <RiderWallet />
          </RiderLayout>
        </Route>
        <Route path="/rider/history">
          <RiderLayout pageTitle="Trip History">
            <RiderTrips />
          </RiderLayout>
        </Route>
        <Route path="/rider/favorites">
          <RiderLayout pageTitle="Favorites">
            <RiderHome />
          </RiderLayout>
        </Route>
        <Route path="/rider/places">
          <RiderLayout pageTitle="Saved Places">
            <RiderHome />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/support">
          <RiderLayout pageTitle="Support">
            <RiderSupport />
          </RiderLayout>
        </Route>
        <Route path="/rider/help">
          <RiderLayout pageTitle="Help Center">
            <RiderSupport />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/account/profile">
          <RiderLayout pageTitle="Edit Profile">
            <RiderAccount />
          </RiderLayout>
        </Route>
        <Route path="/rider/account">
          <RiderLayout pageTitle="Account">
            <RiderAccount />
          </RiderLayout>
        </Route>
        
        <Route path="/rider/settings/notifications">
          <RiderLayout pageTitle="Notification Settings">
            <RiderSettings />
          </RiderLayout>
        </Route>
        <Route path="/rider/settings/privacy">
          <RiderLayout pageTitle="Privacy Settings">
            <RiderSettings />
          </RiderLayout>
        </Route>
        <Route path="/rider/settings">
          <RiderLayout pageTitle="Settings">
            <RiderSettings />
          </RiderLayout>
        </Route>
        
        {/* Ride Booking Flow */}
        <Route path="/rider/ride/new">
          <RiderLayout pageTitle="Book a Ride">
            <RideNew />
          </RiderLayout>
        </Route>
        <Route path="/rider/ride/pickup">
          <RiderLayout pageTitle="Set Pickup">
            <RidePickup />
          </RiderLayout>
        </Route>
        <Route path="/rider/ride/dropoff">
          <RiderLayout pageTitle="Set Dropoff">
            <RideDropoff />
          </RiderLayout>
        </Route>
        <Route path="/rider/ride/options">
          <RiderLayout pageTitle="Ride Options">
            <RideOptions />
          </RiderLayout>
        </Route>
        <Route path="/rider/ride/confirm">
          <RiderLayout pageTitle="Confirm Ride">
            <RideConfirm />
          </RiderLayout>
        </Route>
        <Route path="/rider/trip/active">
          <RiderLayout pageTitle="Active Trip">
            <RiderTripActive />
          </RiderLayout>
        </Route>
        <Route path="/rider/trip/:id/receipt">
          <RiderLayout pageTitle="Trip Receipt">
            <RiderTripReceipt />
          </RiderLayout>
        </Route>
      </Switch>
    </RideBookingProvider>
  );
}
